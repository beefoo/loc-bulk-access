(function initPopup() {
  const config = {
    apiResponseValidator,
    getAPIURL,
  };
  const app = new BulkAccess(config);
  app.onPopup();
}());
