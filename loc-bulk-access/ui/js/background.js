(function initPage() {
  const app = new BulkAccess({});

  app.browser.runtime.onStartup.addListener(() => {
    app.onStartup();
  });

  app.browser.tabs.onUpdated.addListener(() => {
    app.onStartup();
  });
}());
