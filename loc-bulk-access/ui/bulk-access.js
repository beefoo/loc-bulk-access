class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      appendParamsToURL: {},
      baseURL: 'https://www.mywebsite.org/',
      validator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.el = document.getElementById('main');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      this.processURL(tabs[0].url);
    });
  }

  async processURL(url) {
    const { el } = this;
    el.classList.add('is-loading');
    const apiURL = Utilities.appendParamsToURL(url, this.options.appendParamsToURL);
    const response = await fetch(apiURL);
    const apiResponse = await response.json();
    const valid = this.options.validator(apiResponse);
  }
}
