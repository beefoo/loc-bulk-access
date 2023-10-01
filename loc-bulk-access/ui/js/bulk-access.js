class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      browser: 'firefox',
      apiResponseValidator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
      getAPIURL: (url) => url,
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.browser = this.options.browser === 'chrome' ? chrome : browser;
    this.el = document.getElementById('main');
    this.messageEl = document.getElementById('message');
    this.queue = [];
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
    const { queueContainer } = this;
    queueContainer.onclick = (e) => {
      const removeItem = e.target.closest('.remove-item');
      const moveItemUp = e.target.closest('.move-item-up');
      const moveItemDown = e.target.closest('.move-item-down');
      if (removeItem) {
        this.removeQueueItem(parseInt(removeItem.getAttribute('data-index'), 10));
      } else if (moveItemUp) {
        this.moveQueueItem(parseInt(moveItemUp.getAttribute('data-index'), 10), -1);
      } else if (moveItemDown) {
        this.moveQueueItem(parseInt(moveItemDown.getAttribute('data-index'), 10), 1);
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
      const exists = this.queue.find((qitem) => qitem.url === item.url);
      if (exists) {
        reject(new Error('URL is already in queue'));
        return;
      }
      // add to queue
      this.queue.push({
        status: 'queued',
        time: Date.now(),
        item,
      });
      this.saveQueue().then(() => {
        resolve();
      // set failed
      }, (error) => {
        this.queue.pop();
        reject(new Error(error));
      });
    });
  }

  checkURL(url) {
    const { el } = this;
    el.classList.add('is-loading');
    const apiURL = this.options.getAPIURL(url);
    return new Promise((resolve, reject) => {
      fetch(apiURL)
        .then((response) => response.json())
        .then((data) => {
          const resp = this.options.apiResponseValidator(data);
          el.classList.remove('is-loading');
          if (resp.valid) {
            resp.url = url;
            resp.apiURL = apiURL;
            resolve(resp);
          } else {
            reject(validator.message);
          }
        })
        .catch((error) => {
          el.classList.remove('is-loading');
          reject(error);
        });
    });
  }

  createTab(url) {
    this.browser.tabs.create({ active: true, url });
    window.close();
  }

  loadQueue() {
    return Utilities.storageGet(this.browser, 'queue', []);
  }

  message(text, type = 'notice') {
    const { messageEl } = this;
    messageEl.classList.remove('error', 'success', 'notice');
    messageEl.classList.add(type);
    messageEl.innerHTML = text;
  }

  moveQueueItem(index, amount) {
    console.log(index + amount);
    const newIndex = Math.max(Math.min(index + amount, this.queue.length - 1), 0);
    console.log(index, newIndex);
    if (newIndex === index) return;
    const [item] = this.queue.splice(index, 1);
    this.queue.splice(newIndex, 0, item);
    this.saveQueue();
    this.renderQueue();
  }

  onAddedToQueue() {
    const { addToQueueEl } = this;
    addToQueueEl.classList.add('added');
    addToQueueEl.innerHTML = '✓ Added to queue';
    addToQueueEl.disabled = true;
    this.showQueueButton();
  }

  onPopup() {
    this.addToQueueEl = document.getElementById('add-queue-button');
    this.viewQueueEl = document.getElementById('view-queue-button');
    this.currentQueueItem = false;

    this.addPopupListeners();

    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const queuePromise = this.loadQueue();
    Promise.all([tabsPromise, queuePromise]).then((values) => {
      const [tabs, queue] = values;
      this.queue = queue;
      this.checkURL(tabs[0].url).then((resp) => {
        this.message(resp.message, 'success');
        this.currentQueueItem = resp;
        this.addToQueueEl.classList.add('active');
        // check if url is already in queue
        const exists = queue.find((qitem) => qitem.url === resp.url);
        if (exists) this.onAddedToQueue();
      }, (error) => {
        this.message(error, 'error');
      });
      if (this.queue.length > 0) this.showQueueButton();
      else this.viewQueueEl.classList.remove('active');
    });
  }

  onViewQueue() {
    this.queueContainer = document.getElementById('queue-tbody');
    this.addQueueListeners();
    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const queuePromise = this.loadQueue();
    Promise.all([tabsPromise, queuePromise]).then((values) => {
      const [tabs, queue] = values;
      this.queue = queue;
      const { url } = tabs[0];
      this.browser.storage.local.set({ queuePageURL: url });
      this.renderQueue();
    });
  }

  removeQueueItem(queueIndex) {
    this.queue.splice(queueIndex, 1);
    this.saveQueue();
    this.renderQueue();
  }

  renderQueue() {
    const { queueContainer } = this;
    let html = '';
    this.queue.forEach((qitem, index) => {
      const { item } = qitem;
      const facetsString = 'facets' in item && item.facets.length > 0 ? item.facets.map((f) => `<span class="facet">${f}</span>`).join('') : '';
      const title = facetsString.length > 0 ? `${item.title} ${facetsString}` : item.title;
      html += '<tr>';
      html += '<td>';
      html += `  <label for="select-item-${index}" class="visually-hidden">Select this item</label>`;
      html += `  <input id="select-item-${index}" type="checkbox" class="select-item" checked data-index="${index}" `;
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
    });
    queueContainer.innerHTML = html;
  }

  saveQueue() {
    return this.browser.storage.local.set({ queue: this.queue });
  }

  showQueueButton() {
    const { viewQueueEl } = this;
    viewQueueEl.innerHTML = `View queue <span class="number">${this.queue.length}</span>`;
    viewQueueEl.classList.add('active');
  }
}
