// This file should contain all logic specific to Library of Congress JSON API
// The main bulk-access.js should be agnostic to data source and one day could support other APIs
(function initLOC() {
  // function for validating an API response
  const validator = (apiResponse) => {
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

  const config = {
    appendParamsToURL: { fo: 'json', c: 150 },
    baseURL: 'https://www.loc.gov/',
    validator,
  };
  return new BulkAccess(config);
}());
