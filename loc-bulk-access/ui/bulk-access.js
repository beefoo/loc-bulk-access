class BulkAccess {
  constructor(options = {}) {
    const defaults = {
      apiResponseValidator: (apiResponse) => ({ valid: false, type: 'Unknown', count: 0 }),
      baseURL: 'https://www.mywebsite.org/',
      getAPIURL: (url) => url,
    };
    this.options = Object.assign(defaults, options);
    this.init();
  }

  init() {
    this.el = document.getElementById('main');
    this.messageEl = document.getElementById('message');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      this.processURL(tabs[0].url);
    });
  }

  processURL(url) {
    const { el } = this;
    el.classList.add('is-loading');
    const apiURL = this.options.getAPIURL(url);
    fetch(apiURL)
      .then((response) => response.json())
      .then((data) => {
        const validator = this.options.apiResponseValidator(data);
        if (validator.valid) {
          console.log(validator);
        } else {
          console.log(validator);
        }
      })
      .catch((error) => {
        console.log(error);
      });
  }
}
