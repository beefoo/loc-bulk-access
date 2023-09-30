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
      this.browser.storage.local.set({ queue: this.queue }).then(() => {
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

    // add listeners
    this.addToQueueEl.onclick = (e) => {
      this.addToQueue(this.currentQueueItem).then(() => {
        this.onAddedToQueue();
      }, (error) => {
        this.message(error, 'error');
      });
    };
    this.viewQueueEl.onclick = (e) => {
      Utilities.storageGet(this.browser, 'queuePageURL', 'queue.html').then((pageURL) => {
        if (pageURL === 'queue.html') {
          this.createTab('queue.html');
        } else {
          // check if query tab is already open
          this.browser.tabs.query({ url: pageURL }).then((tabs) => {
            if (tabs.length > 0) {
              const [tab] = tabs;
              this.browser.tabs.update(tab.id, { active: true });
              window.close();
            } else {
              this.createTab('queue.html');
            }
          }, (error) => {
            this.createTab('queue.html');
          });
        }
      }, (error) => {
        this.createTab('queue.html');
      });
    };

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
    // retrieve current tab and queue
    const tabsPromise = this.browser.tabs.query({ active: true, currentWindow: true });
    const queuePromise = this.loadQueue();
    Promise.all([tabsPromise, queuePromise]).then((values) => {
      const [tabs, queue] = values;
      this.queue = queue;
      const { url } = tabs[0];
      this.browser.storage.local.set({ queuePageURL: url });
    });
  }

  showQueueButton() {
    const { viewQueueEl } = this;
    viewQueueEl.innerHTML = `View queue <span class="number">${this.queue.length}</span>`;
    viewQueueEl.classList.add('active');
  }
}
