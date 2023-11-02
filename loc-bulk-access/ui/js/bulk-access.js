class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      apiItemsPerPage: 150,
      apiResponseValidator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
      browser: 'firefox',
      getAPIURL: (url, count = false) => url,
      maxDownloadAttempts: 3,
      parseAPIResponse: (apiResponse) => false,
      queueItemStatuses: [
        'queued',
        'downloading metadata',
        'downloading assets',
        'completed',
        'completed with errors',
      ],
      timeBetweenRequests: 1000,
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
    const { queueContainer, toggleQueueButton } = this;

    // Listener for dynamic rows
    queueContainer.onclick = (e) => {
      const removeItem = e.target.closest('.remove-item');
      const moveItemUp = e.target.closest('.move-item-up');
      const moveItemDown = e.target.closest('.move-item-down');
      const selectItem = e.target.closest('.select-item');
      if (removeItem) {
        this.removeQueueItem(parseInt(removeItem.getAttribute('data-index'), 10));
      } else if (moveItemUp) {
        this.moveQueueItem(parseInt(moveItemUp.getAttribute('data-index'), 10), -1);
      } else if (moveItemDown) {
        this.moveQueueItem(parseInt(moveItemDown.getAttribute('data-index'), 10), 1);
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
        this.browser.tabs.reload(this.tabId);
      }
    });
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
        resolve(state);
      }, (error) => {
        reject(error);
      });
    });
  }

  logMessage(text, type = 'notice') {
    const time = new Date().toISOString().replace('T', ' ').replace(/\.[0-9]+Z/, ''); // YYYY-MM-DDTHH:mm:ss.sssZ
    this.state.log.push({
      text,
      time,
      type,
    });
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
      this.renderQueue();
      this.renderSettings();
      this.renderLog();
      this.renderQueueButton();
      this.addQueueListeners();
    });
  }

  openQueuePage() {
    const queuePageURL = 'queue.html';
    const queuePage = {
      url: queuePageURL,
    };
    Utilities.storageGet(this.browser, 'queuePage', queuePage).then((page) => {
      const pageURL = page.url;
      if (pageURL === queuePageURL) {
        this.createTab(queuePageURL);
      } else {
        // check if query tab is already open
        this.browser.tabs.query({ url: pageURL }).then((tabs) => {
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
    }, (error) => {
      this.createTab(queuePageURL);
    });
  }

  pauseQueue() {
    this.isInProgress = false;
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
    let html = '';
    queue.forEach((qitem, index) => {
      const { item } = qitem;
      const facetsString = 'facets' in item && item.facets.length > 0 ? item.facets.map((f) => `<span class="facet">${f}</span>`).join('') : '';
      const title = facetsString.length > 0 ? `${item.title} ${facetsString}` : item.title;
      const selectedString = 'selected' in qitem && qitem.selected === true ? ' checked' : '';
      html += '<tr>';
      html += '<td>';
      html += `  <label for="select-item-${index}" class="visually-hidden">Select this item</label>`;
      html += `  <input id="select-item-${index}" type="checkbox" class="select-item"${selectedString} data-index="${index}" `;
      html += '</td>';
      html += `<td class="type type-${item.type}">${item.type}</td>`;
      html += `<td class="title"><a href="${item.url}" target="_blank">${title}</a></td>`;
      html += `<td class="count">${item.countF}</td>`;
      html += `<td class="status type-${qitem.status.replaceAll(' ', '-')}">${qitem.status}</td>`;
      html += '<td class="actions">';
      html += `  <button class="move-item-up" data-index="${index}" title="Move up in queue"><span class="visually-hidden">move up</span>🠹</button>`;
      html += `  <button class="move-item-down" data-index="${index}" title="Move down in queue"><span class="visually-hidden">move down</span>🠻</button>`;
      html += `  <button class="remove-item" data-index="${index}" title="Remove from queue"><span class="visually-hidden">remove</span>×</button>`;
      html += '</td>';
      html += '</tr>';
    });
    queueContainer.innerHTML = html;
    this.setBadgeText(queue.length);
  }

  renderQueueButton() {
    const { toggleQueueButton } = this;
    const { queue } = this.state;
    const activeQueue = queue.filter((qitem) => this.constructor.isQueueItemActive(qitem));
    let started = false;
    const completed = activeQueue.length <= 0;
    activeQueue.forEach((qitem, index) => {
      if (qitem.status !== 'queued') started = true;
    });
    toggleQueueButton.innerText = started ? 'Resume queue' : 'Start queue';
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

  resumeQueue() {
    this.isInProgress = true;
    const { queue, settings } = this.state;
    const { maxDownloadAttempts, parseAPIResponse, timeBetweenRequests } = this.options;
    const nextActiveIndex = queue.findIndex((qitem) => this.constructor.isQueueItemActive(qitem));
    if (nextActiveIndex < 0) {
      this.pauseQueue();
      this.renderQueueButton();
      this.logMessage('Queue finished!', 'success');
      return;
    }
    // TODO: disable qitem manipulation while in progress
    const i = nextActiveIndex;
    const qitem = queue[i];

    // check to see if we need to download metadata
    if (['queued', 'downloading metadata', 'metadata error'].contains(qitem.status)) {
      const apiRequests = 'apiRequests' in qitem ? qitem.apiRequests : [];
      // check to see if we have not yet made an API request yet
      if (apiRequests.length === 0) {
        apiRequests.push({
          attempts: 0,
          date: Date.now(),
          index: 0,
          response: false,
          status: 'queued',
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
          this.state.queue[i].status = 'downloaded metadata';
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
          url: lastRequest.response.nextPageURL,
        });
        reqCount += 1;
        nextActiveRequest = apiRequests[reqCount - 1];
      }
      const j = nextActiveRequest.index;
      apiRequests[j].status = 'in progress';
      apiRequests[j].attempts += 1;
      const { attempts } = apiRequests[j];
      // we reached too many attempts
      if (attempts > maxDownloadAttempts) {
        this.state.queue[i].status = 'metadata error';
        this.saveState();
        this.logMessage(`Reached max attempts for API request ${nextActiveRequest.url}. Stopping queue. The website might be down or we reached an data request limit. Please try again later.`, 'error');
        this.pauseQueue();
        return;
      }
      // make the Request
      const request = new Request(nextActiveRequest.url, { method: 'GET' });
      request.json().then((resp) => {
        const data = parseAPIResponse(resp);
        // data successfully retrieved and parsed
        if (data !== false) {
          apiRequests[j].response = data;
          apiRequests[j].status = 'completed';
        // error in parsing data
        } else {
          apiRequests[j].status = 'error';
          this.logMessage(`Could not parse data from ${nextActiveRequest.url} (attempt #${attempts} of ${maxDownloadAttempts})`, 'error');
        }
        this.state.queue[i].apiRequests = apiRequests.slice();
        this.saveState();
        setTimeout(() => {
          this.resumeQueue();
        }, timeBetweenRequests);
      // error in the request
      }).catch((error) => {
        apiRequests[j].status = 'error';
        this.logMessage(`Coudl not retrieve data from ${nextActiveRequest.url} (attempt #${attempts} of ${maxDownloadAttempts})`, 'error');
        this.state.queue[i].apiRequests = apiRequests.slice();
        this.saveState();
        setTimeout(() => {
          this.resumeQueue();
        }, timeBetweenRequests);
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
    checkboxes.forEach((el) => {
      const checkbox = el;
      if (checkbox.checked !== isChecked) {
        checkbox.checked = isChecked;
        isChanged = true;
      }
      const index = parseInt(el.getAttribute('data-index'), 10);
      this.state.queue[index].selected = true;
    });
    if (isChanged) {
      this.saveState();
      this.renderQueueButton();
    }
  }

  selectQueueItem(index, isSelected) {
    if (this.isInProgress) return;
    this.state.queue[index].selected = isSelected;
    this.saveState();
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
    if (this.isInProgress) this.pauseQueue();
    else this.resumeQueue();
  }
}
