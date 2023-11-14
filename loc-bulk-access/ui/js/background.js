(function initPage() {
  const config = {
    getAPIURL,
  };
  const app = new BulkAccess(config);

  app.browser.runtime.onStartup.addListener(() => {
    app.onStartup();
  });

  app.browser.tabs.onActivated.addListener(() => {
    app.onStartup();
  });

  app.browser.tabs.onUpdated.addListener(() => {
    app.onStartup();
  });
}());
