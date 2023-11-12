class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      apiItemsPerPage: 150,
      apiResponseValidator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
      browser: 'firefox',
      getAPIURL: (url, count = false) => url,
      maxArchivedQueueItems: 50,
      maxDownloadAttempts: 3,
      maxLogCount: 500,
      parseAPIResponse: (apiResponse) => false,
      timeBetweenRequests: 1000,
      timeBetweenAssetDownloadAttempts: 2000,
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.browser = this.options.browser === 'chrome' ? chrome : browser;
    this.el = document.getElementById('main');
    this.messageEl = document.getElementById('message');
    this.defaultState = {
      log: [],
      queue: [],
      settings: {
        dataFormat: 'csv',
        downloadOption: 'data',
        assetSize: 'smallest',
        resourceDownload: 'first',
      },
    };
    this.state = this.defaultState;
  }

  addPopupListeners() {
    // add listeners
    this.addToQueueEl.onclick = (e) => {
      this.addToQueue(this.currentQueueItem).then(() => {
        this.onAddedToQueue();
      }, (error) => {
        this.message(error, 'error');
      });
    };
    this.viewQueueEl.onclick = (e) => {
      this.openQueuePage();
    };
  }

  addQueueListeners() {
    const { logContainer, queueContainer, toggleQueueButton } = this;

    // Listener for dynamic rows
    queueContainer.onclick = (e) => {
      const removeItem = e.target.closest('.remove-item');
      const moveItemUp = e.target.closest('.move-item-up');
      const moveItemDown = e.target.closest('.move-item-down');
      const selectItem = e.target.closest('.select-item');
      if (removeItem) {
        this.removeQueueItem(parseInt(removeItem.getAttribute('data-index'), 10));
      } else if (moveItemUp) {
        this.moveQueueItem(parseInt(moveItemUp.getAttribute('data-index'), 10), 1);
      } else if (moveItemDown) {
        this.moveQueueItem(parseInt(moveItemDown.getAttribute('data-index'), 10), -1);
      } else if (selectItem) {
        this.selectQueueItem(parseInt(selectItem.getAttribute('data-index'), 10), selectItem.checked);
      }
    };

    // Listen for select all/none
    const selectAllCheckbox = document.getElementById('select-all');
    selectAllCheckbox.onclick = (e) => {
      this.selectAll(selectAllCheckbox.checked);
    };

    // listen for settings options
    const settingOptions = document.querySelectorAll('.settings-option');
    settingOptions.forEach((option) => {
      this.setSettingOptionListeners(option);
    });

    // toggle queue start
    toggleQueueButton.onclick = (e) => {
      this.toggleQueue();
    };

    // if this tab becomes active, refresh
    this.browser.tabs.onActivated.addListener((activeInfo) => {
      if (activeInfo.tabId === this.tabId) {
        this.renderQueue();
        this.renderQueueButton();
      }
    });

    // listen for downloads
    this.browser.downloads.onChanged.addListener((delta) => {
      this.onDownloadsChanged(delta);
    });

    logContainer.onclick = (e) => {
      // listen for show-download folder
      const showDownloadFolder = e.target.closest('.show-download-folder');
      if (showDownloadFolder) {
        this.showDownloadFolder(parseInt(showDownloadFolder.getAttribute('data-id'), 10));
      }
    };
  }

  addToQueue(item) {
    return new Promise((resolve, reject) => {
      if (!item) {
        reject(new Error('URL is invalid'));
        return;
      }
      // check if URL already is queued
      const exists = this.state.queue.find((qitem) => qitem.url === item.url);
      if (exists) {
        reject(new Error('URL is already in queue'));
        return;
      }
      // add to queue
      this.state.queue.push({
        status: 'queued',
        selected: true,
        time: Date.now(),
        item,
      });
      this.saveState().then(() => {
        resolve();
      // set failed
      }, (error) => {
        this.state.queue.pop();
        reject(new Error(error));
      });
    });
  }

  checkURL(url) {
    const { el } = this;
    el.classList.add('is-loading');
    const apiURL = this.options.getAPIURL(url);
    return new Promise((resolve, reject) => {
      if (apiURL !== false) {
        fetch(apiURL)
          .then((response) => response.json())
          .then((data) => {
            const resp = this.options.apiResponseValidator(data);
            el.classList.remove('is-loading');
            if (resp.valid) {
              resp.url = url;
              resp.apiURL = this.options.getAPIURL(url, this.options.apiItemsPerPage);
              resolve(resp);
            } else {
              reject(validator.message);
            }
          })
          .catch((error) => {
            el.classList.remove('is-loading');
            reject(error);
          });
      } else {
        el.classList.remove('is-loading');
        reject(new Error('Bulk access tool only works on www.loc.gov URLs.'));
      }
    });
  }

  createTab(url) {
    this.browser.tabs.create({ active: true, url });
    window.close();
  }

  static disableInputs(isDisabled = true) {
    const inputs = document.querySelectorAll('.disable-when-active');
    inputs.forEach((input) => {
      // eslint-disable-next-line no-param-reassign
      input.disabled = isDisabled;
    });
  }

  downloadItemAsset(itemIndex, resourceIndex, url, resourcePath) {
    const i = itemIndex;
    const j = resourceIndex;
    const resource = this.state.queue[i].resources[j];

    // check to see if we reached too many attempts
    if (resource.attempts >= this.options.maxDownloadAttempts) {
      this.state.queue[i].resources[j].status = 'completed';
      this.state.queue[i].resources[j].skipped = true;
      this.logMessage(`Max attempts to download ${url} reached. Skipping.`, 'error');
      setTimeout(() => {
        this.resumeQueue();
      }, this.options.timeBetweenAssetDownloadAttempts);
      return;
    }

    // trigger download
    this.browser.downloads.download({
      conflictAction: 'overwrite',
      filename: resourcePath,
      saveAs: false,
      url,
    // on download start
    }).then((id) => {
      this.state.queue[i].resources[j].downloadId = id;
      this.state.queue[i].resources[j].filePath = resourcePath;
      this.state.queue[i].resources[j].status = 'in_progress';
      this.state.queue[i].resources[j].attempts += 1;
      this.saveState();
      const resourceCount = this.state.queue[i].resources.length;
      const { attempts } = this.state.queue[i].resources[j];
      const attemptString = attempts > 1 ? ` - attempt #${attempts}` : '';
      this.logMessage(`Downloading asset ${resourcePath} (${j + 1} of ${resourceCount})${attemptString}`, 'notice', j > 0);
    // on download interrupt
    }, (error) => {
      if (!this.isInProgress) return;
      this.state.queue[i].resources[j].status = 'error';
      this.state.queue[i].resources[j].error = error;
      this.state.queue[i].resources[j].attempts += 1;
      this.logMessage(`Download of ${url} was interrupted. Retrying.`, 'error');
      setTimeout(() => {
        this.resumeQueue();
      }, this.options.timeBetweenAssetDownloadAttempts);
    });

    // save state
    this.state.queue[i].status = 'downloading assets';
    this.saveState();
    this.renderQueue();
  }

  downloadQueueItemData(i, dataFilename) {
    const { settings } = this.state;
    const qitem = this.state.queue[i];

    // retrieve metadata
    const flatResults = this.constructor.getFlattenedResults(qitem);

    // no metadata (and thus no assets) to download; mark everything as complete
    if (flatResults.length === 0) {
      this.state.queue[i].status = 'completed';
      this.saveState();
      this.renderQueue();
      return;
    }

    // convert data to a downloadable url
    let dataString = '';
    if (settings.dataFormat === 'csv') dataString = Utilities.getCSVString(flatResults);
    else dataString = JSON.stringify(flatResults);
    const dataBytes = new TextEncoder().encode(dataString);
    const dataBlob = new Blob([dataBytes], {
      type: `application/${settings.dataFormat};charset=utf-8`,
    });
    const dataURL = URL.createObjectURL(dataBlob);

    // trigger download
    this.browser.downloads.download({
      conflictAction: 'overwrite',
      filename: dataFilename,
      saveAs: false,
      url: dataURL,
    // on download start
    }).then((id) => {
      this.state.queue[i].dataDownloadId = id;
      this.saveState();
    // on download interrupt
    }, (error) => {
      if (!this.isInProgress) return;
      this.logMessage(`Download of ${dataFilename} was interrupted. Retrying.`, 'error');
      this.resumeQueue();
    });

    // save state
    this.state.queue[i].dataURL = dataURL;
    this.state.queue[i].dataFilename = dataFilename;
    this.state.queue[i].status = 'downloading data';
    this.saveState();
    this.renderQueue();
    this.logMessage(`Downloading data to file ${dataFilename}`);
  }

  static getFlattenedResults(qitem) {
    if (!('apiRequests' in qitem)) return [];
    const results = qitem.apiRequests.map((req) => (req.response ? req.response.results : []));
    return results.flat();
  }

  static isQueueItemActive(qitem) {
    return qitem.selected && !qitem.status.startsWith('completed');
  }

  loadState() {
    return new Promise((resolve, reject) => {
      Utilities.storageGet(this.browser, 'state', this.defaultState).then((stateData) => {
        // make sure state has all the keys in default state
        const defaultState = structuredClone(this.defaultState);
        const defaultSettings = structuredClone(this.defaultState.settings);
        const state = Object.assign(defaultState, stateData);
        const settings = Object.assign(defaultSettings, state.settings);
        state.settings = settings;
        state.queue = this.constructor.parseQueue(state.queue);
        resolve(state);
      }, (error) => {
        reject(error);
      });
    });
  }

  logMessage(text, type = 'notice', replace = false, tag = '') {
    const { maxLogCount } = this.options;
    const time = Utilities.getTimeString();
    const logData = {
      tag, text, time, type,
    };
    const logCount = this.state.log.length;
    if (replace && logCount > 0 && this.state.log[0].type !== 'error') this.state.log[0] = logData;
    else this.state.log.unshift(logData);

    // limit the length of the log
    if (this.state.log.length > maxLogCount) this.state.log.slice(0, maxLogCount);

    this.renderLog();
    this.saveState();
  }

  message(text, type = 'notice') {
    const { messageEl } = this;
    messageEl.classList.remove('error', 'success', 'notice');
    messageEl.classList.add(type);
    messageEl.innerHTML = text;
  }

  moveQueueItem(index, amount) {
    if (this.isInProgress) return;
    const newIndex = Math.max(Math.min(index + amount, this.state.queue.length - 1), 0);
    if (newIndex === index) return;
    const [item] = this.state.queue.splice(index, 1);
    this.state.queue.splice(newIndex, 0, item);
    this.saveState();
    this.renderQueue();
  }

  onAddedToQueue() {
    const { addToQueueEl } = this;
    addToQueueEl.classList.add('added');
    addToQueueEl.innerHTML = '✓ Added to queue';
    addToQueueEl.disabled = true;
    this.showQueueButton();
    this.setBadgeText(this.state.queue.length);
  }

  onDownloadedAsset(itemIndex, resourceIndex) {
    const i = itemIndex;
    const j = resourceIndex;
    const resourceCount = this.state.queue[i].resources.length;
    const resource = this.state.queue[i].resources[j];
    this.state.queue[i].resources[j].status = 'completed';
    this.saveState();
    this.logMessage(`Downloaded asset ${resource.filePath} (${j + 1} of ${resourceCount})`, 'notice', true);
    if (this.isInProgress) {
      setTimeout(() => {
        this.resumeQueue();
      }, this.options.timeBetweenAssetDownloadAttempts);
    }
  }

  onDownloadedQueueItemData(i) {
    const qItem = this.state.queue[i];
    if (qItem) URL.revokeObjectURL(qItem.dataURL);
    this.state.queue[i].status = 'downloaded data';
    this.saveState();
    this.renderQueue();
  }

  onDownloadsChanged(delta) {
    const { queue } = this.state;
    const downloadId = delta.id;
    let i = queue.findIndex((item) => item.dataDownloadId === downloadId);
    let j;
    let isAsset = false;
    // not data download; check to see if asset download
    if (i < 0) {
      const assets = queue.map((item, ii) => {
        if (!('resources' in item)) return [];
        return item.resources.map((resource, jj) => {
          const dlId = 'downloadId' in resource ? resource.downloadId : false;
          return {
            itemIndex: ii,
            resourceIndex: jj,
            downloadId: dlId,
          };
        });
      }).flat();
      const foundAsset = assets.find((asset) => asset.downloadId === downloadId);
      if (foundAsset) {
        isAsset = true;
        i = foundAsset.itemIndex;
        j = foundAsset.resourceIndex;
      } else return;
    }
    const qItem = queue[i];
    const resource = isAsset ? qItem.resources[j] : false;
    const filename = resource !== false ? resource.url : qItem.dataFilename;

    // state has changed to complete
    if (delta.state && delta.state.current === 'complete') {
      if (isAsset) {
        this.onDownloadedAsset(i, j);
      } else {
        this.onDownloadedQueueItemData(i);
        this.logMessage(`Downloaded data to ${filename} <button class="show-download-folder" data-id="${downloadId}">open download folder</button>`, 'success', true);
        if (this.isInProgress) this.resumeQueue();
      }
      return;
    }

    // error triggered
    if (delta.error) {
      this.logMessage(`Download error: ${data.error.current}`, 'error');
    }

    // state has changed to interrupted
    if (delta.state && delta.state.current === 'interrupted') {
      // if queue is in progress, try again after a pause
      if (this.isInProgress) {
        if (isAsset) {
          setTimeout(() => {
            this.resumeQueue();
          }, this.options.timeBetweenAssetDownloadAttempts);
        } else {
          setTimeout(() => {
            this.resumeQueue();
          }, this.options.timeBetweenRequests);
        }
      }
      this.logMessage(`Download of ${filename} interrupted.`, 'error');
    }

    // download was paused
    if (delta.paused && delta.paused.current === true) {
      if (this.isInProgress) this.pauseQueue(true);
    }
  }

  onPopup() {
    this.addToQueueEl = document.getElementById('add-queue-button');
    this.viewQueueEl = document.getElementById('view-queue-button');
    this.currentQueueItem = false;

    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const statePromise = this.loadState();
    Promise.all([tabsPromise, statePromise]).then((values) => {
      const [tabs, state] = values;
      this.state = state;
      this.checkURL(tabs[0].url).then((resp) => {
        this.message(resp.message, 'success');
        this.currentQueueItem = resp;
        this.addToQueueEl.classList.add('active');
        // check if url is already in queue
        const exists = state.queue.find((qitem) => qitem.item.url === resp.url);
        if (exists) this.onAddedToQueue();
      }, (error) => {
        this.message(error, 'error');
      });
      if (this.state.queue.length > 0) this.showQueueButton();
      else this.viewQueueEl.classList.remove('active');
      this.addPopupListeners();
    });
  }

  onStartup() {
    const statePromise = this.loadState();
    statePromise.then((state) => {
      this.setBadgeText(state.queue.length);
    });
  }

  onViewQueue() {
    this.isInProgress = false;
    this.queueContainer = document.getElementById('queue-tbody');
    this.toggleQueueButton = document.getElementById('toggle-queue');
    this.logContainer = document.getElementById('queue-log');
    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const statePromise = this.loadState();
    Promise.all([tabsPromise, statePromise]).then((values) => {
      const [tabs, state] = values;
      this.state = state;
      const { url, id } = tabs[0];
      this.browser.storage.local.set({ queuePage: { url, id } });
      this.tabId = id;
      this.pruneQueue();
      this.renderQueue();
      this.renderSettings();
      this.renderLog();
      this.renderQueueButton();
      this.addQueueListeners();
    });
  }

  openQueuePage() {
    const queuePageURL = browser.runtime.getURL('ui/queue.html');
    // check if query tab is already open
    this.browser.tabs.query({ url: queuePageURL }).then((tabs) => {
      if (tabs.length > 0) {
        const [tab] = tabs;
        this.browser.tabs.update(tab.id, { active: true });
        // this.browser.tabs.reload(tab.id);
        window.close();
      } else {
        this.createTab(queuePageURL);
      }
    }, (error) => {
      this.createTab(queuePageURL);
    });
  }

  static parseQueue(queue) {
    return queue.map((qitem) => {
      const qitemCopy = qitem;
      const { item } = qitem;
      const facetsString = 'facets' in item && item.facets.length > 0 ? item.facets.join(', ') : '';
      const fullTitle = facetsString.length > 0 ? `${item.title} (${facetsString})` : item.title;
      qitemCopy.item.fullTitle = fullTitle;
      return qitemCopy;
    });
  }

  pauseActiveDownloads() {
    const { queue } = this.state;
    const activeDownloads = queue.map((item) => {
      if (!('resources' in item)) return [];
      return item.resources.filter((resource) => resource.status === 'in_progress' && 'downloadId' in resource);
    }).flat();
    if (activeDownloads.length === 0) return;
    activeDownloads.forEach((resource) => {
      this.browser.downloads.pause(resource.downloadId);
    });
  }

  pauseQueue(force = false) {
    if (force === false && this.isInProgress) return;
    if (force === true) this.isInProgress = false;
    this.renderQueueButton();
    this.renderQueue();
    this.constructor.disableInputs(false);
    this.pauseActiveDownloads();
  }

  pruneQueue() {
    const { queue } = this.state;
    const { maxArchivedQueueItems } = this.options;
    const completedItems = queue.filter((qitem) => qitem.status === 'completed');
    if (completedItems.length <= maxArchivedQueueItems) return;
    const delta = completedItems.length - maxArchivedQueueItems;
    const prunedItems = completedItems.slice(delta);
    const incompleteItems = queue.filter((qitem) => qitem.status !== 'completed');
    this.state.queue = prunedItems.concat(incompleteItems);
    this.saveState();
  }

  removeQueueItem(queueIndex) {
    if (this.isInProgress) return;
    this.state.queue.splice(queueIndex, 1);
    this.saveState();
    this.renderQueue();
    this.renderQueueButton();
  }

  renderLog() {
    const { logContainer } = this;
    const { log } = this.state;
    let html = '';
    log.forEach((message) => {
      const { type, time, text } = message;
      html += `<p class="log-message ${type}">`;
      html += `<span class="time">${time}</span>`;
      html += `<span class="text">${text}</span>`;
      html += '</p>';
    });
    logContainer.innerHTML = html;
  }

  renderQueue() {
    const { queueContainer } = this;
    const { queue } = this.state;
    const paused = this.isInProgress === false;
    let html = '';
    const qlen = queue.length;
    queue.toReversed().forEach((qitem, rindex) => {
      const index = qlen - rindex - 1;
      const { item } = qitem;
      const facetsString = 'facets' in item && item.facets.length > 0 ? item.facets.map((f) => `<span class="facet">${f}</span>`).join('') : '';
      const title = facetsString.length > 0 ? `${item.title} ${facetsString}` : item.title;
      const selectedString = 'selected' in qitem && qitem.selected === true ? ' checked' : '';
      const statusClass = qitem.status.replaceAll(' ', '-');
      const errorClass = statusClass.includes('error') ? 'has-error' : '';
      const statusText = paused && !['queued', 'completed'].includes(qitem.status) ? 'paused' : qitem.status;
      const inProgressClass = !paused && !['queued', 'completed'].includes(qitem.status) && !statusClass.includes('error') ? 'in-progress' : '';
      const disabledString = paused ? '' : 'disabled';
      html += `<tr class="status-${statusClass} ${inProgressClass} ${errorClass}">`;
      html += '<td>';
      html += `  <label for="select-item-${index}" class="visually-hidden">Select this item</label>`;
      html += `  <input id="select-item-${index}" type="checkbox" class="disable-when-active select-item"${selectedString} data-index="${index}" ${disabledString} />`;
      html += '</td>';
      html += `<td class="type type-${item.type}">${item.type}</td>`;
      html += `<td class="title"><a href="${item.url}" target="_blank">${title}</a></td>`;
      html += `<td class="count">${item.countF}</td>`;
      html += `<td class="status status-${statusClass} ${inProgressClass} ${errorClass}">${statusText}</td>`;
      html += '<td class="actions">';
      html += `  <button class="move-item-up disable-when-active" data-index="${index}" title="Move up in queue" ${disabledString}><span class="visually-hidden">move up</span>🠹</button>`;
      html += `  <button class="move-item-down disable-when-active" data-index="${index}" title="Move down in queue" ${disabledString}><span class="visually-hidden">move down</span>🠻</button>`;
      html += `  <button class="remove-item disable-when-active" data-index="${index}" title="Remove from queue" ${disabledString}><span class="visually-hidden">remove</span>×</button>`;
      html += '</td>';
      html += '</tr>';
    });
    queueContainer.innerHTML = html;
    this.setBadgeText(queue.length);
  }

  renderQueueButton() {
    const { toggleQueueButton, isInProgress } = this;
    const { queue } = this.state;
    const activeQueue = queue.filter((qitem) => this.constructor.isQueueItemActive(qitem));
    let started = false;
    const completed = activeQueue.length <= 0;
    activeQueue.forEach((qitem, index) => {
      if (qitem.status !== 'queued') started = true;
    });
    if (completed || !isInProgress) toggleQueueButton.innerText = started ? 'Resume queue' : 'Start queue';
    else toggleQueueButton.innerText = 'Pause queue';
    toggleQueueButton.disabled = completed;
  }

  renderSettings() {
    if (!('settings' in this.state)) return;
    const { settings } = this.state;
    Object.entries(settings).forEach((setting) => {
      const [key, value] = setting;
      const options = document.querySelectorAll(`input[name="${key}"]`);
      options.forEach((option) => {
        const optionRef = option;
        const optionVal = option.getAttribute('value');
        const isChecked = (optionVal === value);
        optionRef.checked = isChecked;
        if (option.classList.contains('toggle') && isChecked) {
          this.constructor.toggleOption(optionRef);
        }
      });
    });
  }

  requeueItem(i) {
    this.state.queue[i].status = 'queued';
    delete this.state.queue[i].dataDownloadId;
  }

  resumeQueue() {
    if (!this.isInProgress) return;

    this.renderQueueButton();

    const { queue, settings } = this.state;
    const { maxDownloadAttempts, parseAPIResponse, timeBetweenRequests } = this.options;

    // retrieve the next active item in the queue
    const nextActiveIndex = queue.findIndex((qitem) => this.constructor.isQueueItemActive(qitem));

    // no more; we are finished!
    if (nextActiveIndex < 0) {
      this.pauseQueue(true);
      this.logMessage('Queue finished!', 'success');
      return;
    }

    // Disable qitem manipulation while in progress
    this.constructor.disableInputs();

    const i = nextActiveIndex;
    const qitem = queue[i];
    const { fullTitle } = qitem.item;

    // check to see if we need to download metadata
    if (['queued', 'retrieving data', 'data retrieval error'].includes(qitem.status)) {
      const apiRequests = 'apiRequests' in qitem ? qitem.apiRequests : [];
      // check to see if we have not yet made an API request yet
      if (apiRequests.length === 0) {
        apiRequests.push({
          attempts: 0,
          date: Date.now(),
          index: 0,
          response: false,
          status: 'queued',
          total: false,
          url: qitem.item.apiURL,
        });
      }
      let reqCount = apiRequests.length;
      // retrieve the next API request
      let nextActiveRequest = apiRequests.find((req) => req.status !== 'completed');
      // all the API requests have been completed; check to see if there are any more
      if (nextActiveRequest === undefined) {
        const lastRequest = apiRequests[reqCount - 1];
        // we have completed the API Requests
        if (lastRequest.response.isLast) {
          this.state.queue[i].status = 'retrieved data';
          this.saveState();
          this.resumeQueue();
          return;
        // otherwise, queue the next one
        }
        apiRequests.push({
          attempts: 0,
          date: Date.now(),
          index: reqCount,
          response: false,
          status: 'queued',
          total: lastRequest.total,
          url: lastRequest.response.nextPageURL,
        });
        reqCount += 1;
        nextActiveRequest = apiRequests[reqCount - 1];
      }
      // we're ready to make the next request
      const j = nextActiveRequest.index;
      const { index, total } = nextActiveRequest;
      this.state.queue[i].status = 'retrieving data';
      apiRequests[j].status = 'in progress';
      apiRequests[j].attempts += 1;
      const { attempts } = apiRequests[j];
      // we reached too many attempts
      if (attempts > maxDownloadAttempts) {
        this.state.queue[i].status = 'data retrieval error';
        this.saveState();
        this.logMessage(`Reached max attempts for API request ${nextActiveRequest.url}. Stopping queue. The website might be down or we reached an data request limit. Please try again later.`, 'error');
        this.pauseQueue(true);
        return;
      }
      this.renderQueue();
      if (total !== false) this.logMessage(`Retrieving API data from "${fullTitle}" (request ${index + 1} of ${total})`, 'notice', (index > 0));
      else this.logMessage(`Retrieving API data from "${fullTitle}" (first request)`);
      // make the Request
      fetch(nextActiveRequest.url)
        .then((resp) => resp.json())
        .then((resp) => {
          // check if paused before the request was finished
          if (!this.isInProgress) return;
          const data = parseAPIResponse(resp);
          // data successfully retrieved and parsed
          if (data !== false) {
            apiRequests[j].response = data;
            apiRequests[j].total = data.total;
            apiRequests[j].status = 'completed';
          // error in parsing data
          } else {
            apiRequests[j].status = 'error';
            this.logMessage(`Could not parse data from ${nextActiveRequest.url} (attempt #${attempts} of ${maxDownloadAttempts})`, 'error');
          }
          // save the state and continue
          this.state.queue[i].apiRequests = apiRequests.slice();
          this.saveState();
          setTimeout(() => {
            this.resumeQueue();
          }, timeBetweenRequests);
        // error in the request
        }).catch((error) => {
          // check if paused before the request was finished
          if (!this.isInProgress) return;
          apiRequests[j].status = 'error';
          this.logMessage(`Could not retrieve data from ${nextActiveRequest.url} (attempt #${attempts} of ${maxDownloadAttempts})`, 'error');
          // save the state and continue
          this.state.queue[i].apiRequests = apiRequests.slice();
          this.saveState();
          setTimeout(() => {
            this.resumeQueue();
          }, timeBetweenRequests);
        });
      return;
    }

    // all metadata has been retrieved, and data download option is in the settings
    if (['retrieved data', 'downloading data'].includes(qitem.status) && ['data', 'both'].includes(settings.downloadOption)) {
      // check to see if file already exists in downloads
      const dataFilename = `${qitem.item.uid}.${settings.dataFormat}`;
      const searchQuery = 'dataDownloadId' in qitem ? { id: qitem.dataDownloadId } : { filename: dataFilename };

      this.browser.downloads.search(searchQuery).then((downloads) => {
        // check if paused before the request was finished
        if (!this.isInProgress) return;

        // check to see if it is in progress
        const inProgress = downloads.find((dlItem) => dlItem.state === 'in_progress');
        if (inProgress !== undefined) {
          this.state.queue[i].status = 'downloading data';
          this.saveState();
          this.renderQueue();
          return;
        }

        // check to see if it's complete and still exists
        const complete = downloads.find((dlItem) => dlItem.state === 'complete' && dlItem.exists);
        if (complete !== undefined) {
          this.onDownloadedQueueItemData(i);
          this.logMessage(`Data download of ${dataFilename} already completed <button class="show-download-folder" data-id="${dlItem.id}">open download folder</button>`, 'success');
          this.resumeQueue();
          return;
        }

        // check to see if it's interrupted or paused and can resume
        const interrupted = downloads.find((dlItem) => (dlItem.state === 'interrupted' || dlItem.paused) && dlItem.canResume);
        if (interrupted !== undefined) {
          this.browser.downloads.resume(interrupted.id);
          this.state.queue[i].status = 'downloading data';
          this.saveState();
          this.renderQueue();
          this.logMessage(`Resuming data download of ${dataFilename}`);
          return;
        }

        // otherwise, download the data
        this.downloadQueueItemData(i, dataFilename);
      }, (error) => {
        // check if paused before the request was finished
        if (!this.isInProgress) return;
        this.downloadQueueItemData(i, dataFilename);
      });

      return;
    }

    // if we downloaded the data and we only need to download data, item is completed
    if (qitem.status === 'downloaded data' && settings.downloadOption === 'data') {
      this.state.queue[i].status = 'completed';
      this.state.queue[i].selected = false;
      this.saveState();
      this.renderQueue();
      this.resumeQueue();
      return;
    }

    // start to download assets if data option is "both" and we have downloaded our data
    // or if data option is "assets" and we retrieved all the metadata
    if ((qitem.status === 'downloaded data' && settings.downloadOption === 'both')
        || (qitem.status === 'retrieved data' && settings.downloadOption === 'assets')) {
      const { resources } = qitem;
      const nextResourceIndex = resources.findIndex((resource) => resource.status !== 'completed');

      // no resources left to download, mark as complete
      if (nextResourceIndex < 0) {
        this.state.queue[i].status = 'completed';
        this.state.queue[i].selected = false;
        this.saveState();
        this.renderQueue();
        this.resumeQueue();
        return;
      }

      // check to see if asset is already being downloaded
      const j = nextResourceIndex;
      const nextResource = resources[j];
      const resourcePath = `${qitem.item.uid}/${nextResource.filename}`;
      const searchQuery = 'downloadId' in nextResource ? { id: nextResource.downloadId } : { filename: resourcePath };
      this.browser.downloads.search(searchQuery).then((downloads) => {
        // check if paused before the request was finished
        if (!this.isInProgress) return;

        // check to see if it is in progress
        const inProgress = downloads.find((dlItem) => dlItem.state === 'in_progress');
        if (inProgress !== undefined) {
          this.state.queue[i].status = 'downloading assets';
          this.state.queue[i].resources[j].status = 'in_progress';
          this.saveState();
          this.renderQueue();
          return;
        }

        // check to see if it's complete and still exists
        const complete = downloads.find((dlItem) => dlItem.state === 'complete' && dlItem.exists);
        if (complete !== undefined) {
          this.onDownloadedAsset(i, j);
          return;
        }

        // check to see if it's interrupted or paused and can resume
        const interrupted = downloads.find((dlItem) => (dlItem.state === 'interrupted' || dlItem.paused) && dlItem.canResume);
        if (interrupted !== undefined) {
          this.browser.downloads.resume(interrupted.id);
          this.state.queue[i].status = 'downloading assets';
          this.state.queue[i].resources[j].status = 'in_progress';
          this.saveState();
          this.renderQueue();
          this.logMessage(`Resuming asset download of ${resourcePath}`);
          return;
        }

        // otherwise, download asset from scratch
        this.downloadItemAsset(i, j, nextResource.url, resourcePath);
      }, (error) => {
        // check if paused before the request was finished
        if (!this.isInProgress) return;
        this.downloadItemAsset(i, j, nextResource.url, resourcePath);
      });
    }
  }

  saveState() {
    return this.browser.storage.local.set({ state: this.state });
  }

  selectAll(isChecked) {
    if (this.isInProgress) return;
    const checkboxes = document.querySelectorAll('.select-item');
    if (checkboxes.length === 0) return;
    let isChanged = false;
    let statusChanged = false;
    checkboxes.forEach((el) => {
      let itemChanged = false;
      const checkbox = el;
      if (checkbox.checked !== isChecked) {
        checkbox.checked = isChecked;
        isChanged = true;
        itemChanged = true;
      }
      const index = parseInt(el.getAttribute('data-index'), 10);
      const qItem = this.state.queue[index];
      this.state.queue[index].selected = isChecked;
      // if was already completed, re-add to queue
      if (itemChanged && isChecked && qItem.status === 'completed') {
        this.requeueItem(index);
        statusChanged = true;
      }
    });
    if (isChanged) {
      this.saveState();
      if (statusChanged) this.renderQueue();
      this.renderQueueButton();
    }
  }

  selectQueueItem(index, isSelected) {
    if (this.isInProgress) return;
    const qItem = this.state.queue[index];
    let statusChanged = false;
    this.state.queue[index].selected = isSelected;
    // if was already completed, re-add to queue
    if (isSelected && qItem.status === 'completed') {
      this.requeueItem(index);
      statusChanged = true;
    }
    this.saveState();
    if (statusChanged) this.renderQueue();
    this.renderQueueButton();
  }

  setBadgeText(count) {
    const text = count > 0 ? count.toLocaleString() : '+';
    this.browser.browserAction.setBadgeText({ text });
  }

  setSettingOptionListeners(option) {
    const opt = option;
    const name = opt.getAttribute('name');
    const value = opt.getAttribute('value');
    opt.onclick = (e) => {
      const isChecked = opt.checked;

      // update settings
      if (isChecked) {
        this.state.settings[name] = value;
        this.saveState();
      }

      // check if this is a toggler
      if (opt.classList.contains('toggle')) {
        this.constructor.toggleOption(opt);
      }
    };
  }

  showDownloadFolder(downloadId) {
    this.browser.downloads.show(downloadId);
  }

  showQueueButton() {
    const { viewQueueEl } = this;
    viewQueueEl.innerHTML = `View queue <span class="number">${this.state.queue.length}</span>`;
    viewQueueEl.classList.add('active');
  }

  static toggleOption(option) {
    const isChecked = option.checked;
    const toggleActions = Utilities.parseQueryString(option.getAttribute('data-toggle'));
    Object.entries(toggleActions).forEach(([id, toggleAction]) => {
      const target = document.getElementById(id);
      if (isChecked && toggleAction === 'on') target.classList.add('active');
      else target.classList.remove('active');
    });
  }

  toggleQueue() {
    this.isInProgress = !this.isInProgress;
    if (this.isInProgress) {
      this.renderQueue();
      this.resumeQueue();
    } else this.pauseQueue();
  }
}
