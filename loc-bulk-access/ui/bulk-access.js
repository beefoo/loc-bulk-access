class BulkAccess {
  constructor(options = {}) {
    const defaults = {};
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.$el = document.getElementById('main');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      this.processURL(tabs[0].url);
    });
  }

  processURL(url) {
    this.$el.innerHTML = url;
  }
}
