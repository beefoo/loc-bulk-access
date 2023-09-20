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
      this.checkURL(tabs[0].url);
    });
  }

  checkURL(url) {
    const { el, messageEl } = this;
    el.classList.remove('valid', 'invalid');
    el.classList.add('is-loading');
    const apiURL = this.options.getAPIURL(url);
    fetch(apiURL)
      .then((response) => response.json())
      .then((data) => {
        const validator = this.options.apiResponseValidator(data);
        messageEl.innerHTML = validator.message;
        el.classList.remove('is-loading');
        if (validator.valid) this.onValidURL(url);
        else this.onInvalidURL();
      })
      .catch((error) => {
        messageEl.innerHTML = validator.message;
        el.classList.remove('is-loading');
        this.onInvalidURL();
      });
  }

  onInvalidURL() {
    const { el } = this;
    el.classList.add('valid');
  }

  onValidURL(url) {
    const { el } = this;
    el.classList.add('invalid');
  }
}
