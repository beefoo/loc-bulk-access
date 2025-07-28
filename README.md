# Library of Congress Bulk Access Browser Extension

A free and open source browser extension for Chrome and Firefox to enable bulk access to Library of Congress digital collections data and assets using the [Library's public JSON API](https://www.loc.gov/apis/json-and-yaml/).

## Beta status

This extension is currently in a **public "beta" release**, meaning it is open to the public to try, test, and send feedback. Until it is in a stable state, it will not be available in the Chrome or Firefox extension stores and must be manually installed using the steps below.

## Installation

### Chrome Installation

1. Download the latest Chrome extension from the repository's [releases section](https://github.com/LibraryOfCongress/loc-bulk-access/releases) and unzip it.
2. Go to the Extensions page by entering `chrome://extensions` in a new tab.
3. Enable Developer Mode by clicking the toggle switch next to **Developer mode**.
4. Click the **Load unpacked** button and select the unzipped extension directory.
5. Click **Extensions menu puzzle button** next to your search bar, and you should see the "LC Bulk Access" extension listed there, which you can pin to your toolbar.

You can also find these instructions on the [Chrome Extension Developer website](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked).

### Firefox Installation

1. Download the latest Firefoxextension from the repository's [releases section](https://github.com/LibraryOfCongress/loc-bulk-access/releases) and unzip it.
2. Type `about:addons` in the Firefox URL bar.
3. Next to "Manage Your Extensions", click the gear icon, select **Install Add-on From File**, and select the zipped file that you downloaded from step 1.
4. Once installed, click **Extensions menu puzzle button** next to your search bar, and you should see the "LC Bulk Access" extension listed there, which you can pin to your toolbar.

## Using the extension

Once you install the extension using the instructions in the previous section, you can follow the following instructions:

1. Perform any search or facet on loc.gov using the search box or browsing to a specific collection. For this example, we will download the metadata and associated audio files for the [Southern Mosaic collection, with location Texas and query "ballad"](https://www.loc.gov/collections/john-and-ruby-lomax/?fa=original-format:sound+recording%7Clocation:texas&q=ballad) (~51 items)
2. If you have the browser extension pinned, you should see a small LOC icon next to the search toolbar. Click it.
3. You should see a pop-up that will analyze your current search or collection page. If it is valid, you should see a button appear to allow you to add this to your queue.
4. Once you add it to your queue, you can click "View queue" to see what you have added to your queue.
5. You can continue to add to the queue until you are ready to download.
6. When you are ready, select "Download both" to download both the metadata and audio assets for this collection
7. Then click "Start queue" which will start the download process.
8. All files will be downloaded directly to your default downloads folder. In your browser settings, ensure you deselect "Ask where to save each file before downloading," otherwise, your browser will prompt you where to save after each and every downloaded file!

## For Developers

The latest versions of Chrome and Firefox extension APIs are nearly the same, so we recommend developing using Firefox and the [web-ext](https://github.com/mozilla/web-ext) command line tool that will listen for changes to the code and refresh the extension automatically. To run and edit the extension locally, you can do so with the following steps.

1. Make sure you have [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git), [Node.js](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs), and [Firefox](https://www.mozilla.org/en-US/firefox/new/) installed on your computer.

2. Clone this repository:

    ```
    git clone https://github.com/LibraryOfCongress/loc-bulk-access.git
    cd loc-bulk-access
    ```

3. Install Node.js dependencies, including the [web-ext](https://github.com/mozilla/web-ext) command line tool

    ```
    npm install --global web-ext
    npm install
    ```

4. Now you can launch this extension using Firefox and web-ext using the following command:

    ```
    npm run listen
    ```

    Any changes you make in the code will automatically refresh the extension in the Firefox browser

5. Once you test your changes, you should also test your changes in Chrome. You can do this by running:

    ```
    npm run use-chrome
    ```

    Then [follow these instructions](https://developer.chrome.com/docs/extensions/mv3/getstarted/development-basics/#load-unpacked) for loading an unpacked extension, selecting the `.loc-bulk-access/` folder as the unpacked extension.  If you need to switch back to developing on Firefox, run:

    ```
    npm run use-firefox
    ```

6. If you commit your changes and are ready to make a new release, update both `manifest-chrome.json` and `manifest-firefox.json` with an updated "version" key. Then run:

    ```
    npm run build-chrome
    npm run build-firefox
    ```

    This will generate zipped extensions in the `./builds/` directory with the appropriate browser names and versions, which can be uploaded as a release on Github or submitted to the Chrome/Firefox extension stores.
