(function initPage() {
  const config = {
    apiResponseValidator,
    getAPIURL,
  };
  const app = new BulkAccess(config);
  app.onViewQueue();
}());
