// This file should contain all logic specific to Library of Congress JSON API
// The main bulk-access.js should be agnostic to data source and one day could support other APIs
(function initLOC() {
  // function for validating an API response
  const apiResponseValidator = (apiResponse) => {
    const resp = { valid: false, type: 'Unknown', count: 0 };
    if ('item' in apiResponse) {
      resp.valid = true;
      resp.type = 'Item';
      resp.count = 1;
    } else if ('pagination' in apiResponse && 'results' in apiResponse) {
      if (apiResponse.results.length > 0 && 'item' in apiResponse.results[0]) {
        resp.valid = true;
        resp.type = 'Search result';
        resp.count = apiResponse.pagination.of;
        if ('site_type' in apiResponse && apiResponse.site_type === 'collections') {
          resp.type = 'Collection';
        }
      }
    }
    return resp;
  };

  // function for creating an API URL based on current URL
  const getAPIURL = (url) => {
    const apiURL = Utilities.appendParamsToURL(url, { fo: 'json', c: 150 });
    return apiURL;
  };

  const config = {
    apiResponseValidator,
    baseURL: 'https://www.loc.gov/',
    getAPIURL,
  };
  return new BulkAccess(config);
}());
