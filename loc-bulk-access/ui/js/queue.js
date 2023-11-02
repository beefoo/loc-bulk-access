(function initPage() {
  const config = {
    apiResponseValidator,
    getAPIURL,
    parseAPIResponse,
  };
  const app = new BulkAccess(config);
  app.onViewQueue();
}());
