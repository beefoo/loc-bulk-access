class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      apiItemsPerPage: 150,
      apiResponseValidator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
      browser: 'firefox',
      getAPIURL: (url, count = false) => url,
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
      const queuePageURL = 'queue.html';
      Utilities.storageGet(this.browser, 'queuePageURL', queuePageURL).then((pageURL) => {
        if (pageURL === queuePageURL) {
          this.createTab(queuePageURL);
        } else {
          // check if query tab is already open
          this.browser.tabs.query({ url: pageURL }).then((tabs) => {
            if (tabs.length > 0) {
              const [tab] = tabs;
              this.browser.tabs.update(tab.id, { active: true });
              this.browser.tabs.reload(tab.id);
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

  loadState() {
    return Utilities.storageGet(this.browser, 'state', this.defaultState);
  }

  message(text, type = 'notice') {
    const { messageEl } = this;
    messageEl.classList.remove('error', 'success', 'notice');
    messageEl.classList.add(type);
    messageEl.innerHTML = text;
  }

  moveQueueItem(index, amount) {
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

    this.addPopupListeners();

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
    });
  }

  onStartup() {
    const statePromise = this.loadState();
    statePromise.then((state) => {
      this.setBadgeText(state.queue.length);
    });
  }

  onViewQueue() {
    this.queueContainer = document.getElementById('queue-tbody');
    this.toggleQueueButton = document.getElementById('toggle-queue');
    this.logContainer = document.getElementById('queue-log');
    this.addQueueListeners();
    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const statePromise = this.loadState();
    Promise.all([tabsPromise, statePromise]).then((values) => {
      const [tabs, state] = values;
      this.state = state;
      const { url } = tabs[0];
      this.browser.storage.local.set({ queuePageURL: url });
      this.renderQueue();
      this.renderSettings();
      this.renderLog();
    });
  }

  removeQueueItem(queueIndex) {
    this.state.queue.splice(queueIndex, 1);
    this.saveState();
    this.renderQueue();
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
    const { queueContainer, toggleQueueButton } = this;
    const { queue } = this.state;
    let html = '';
    let queueButtonText = 'Start queue';
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
      html += `<td class="status type-${qitem.status}">${qitem.status}</td>`;
      html += '<td class="actions">';
      html += `  <button class="move-item-up" data-index="${index}" title="Move up in queue"><span class="visually-hidden">move up</span>🠹</button>`;
      html += `  <button class="move-item-down" data-index="${index}" title="Move down in queue"><span class="visually-hidden">move down</span>🠻</button>`;
      html += `  <button class="remove-item" data-index="${index}" title="Remove from queue"><span class="visually-hidden">remove</span>×</button>`;
      html += '</td>';
      html += '</tr>';
      if (qitem.status === 'in progress') queueButtonText = 'Pause queue';
      else if (qitem.status !== 'queued' && queueButtonText !== 'Pause queue') queueButtonText = 'Resume queue';
    });
    queueContainer.innerHTML = html;
    toggleQueueButton.innerText = queueButtonText;
    this.setBadgeText(queue.length);
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

  saveState() {
    return this.browser.storage.local.set({ state: this.state });
  }

  selectAll(isChecked) {
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
    if (isChanged) this.saveState();
  }

  selectQueueItem(index, isSelected) {
    this.state.queue[index].selected = isSelected;
    this.saveState();
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
    const { toggleQueueButton } = this;
    const { queue, settings } = this.state;
    toggleQueueButton.disabled = true;
  }
}
