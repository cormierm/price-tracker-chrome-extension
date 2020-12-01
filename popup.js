function setInputFromStorageKey(elementId, storageKey) {
    chrome.storage.sync.get(storageKey, function (data) {
        document.getElementById(elementId).value = data[storageKey] || '';
    });
}

function addUpdateStorageListenerToInput(elementId, storageKey) {
    document.getElementById(elementId).addEventListener('input', (event) => {
        chrome.storage.sync.set({[storageKey]: event.target.value});
    });
}

function addXPathListener(buttonId, storageKey) {
    document.getElementById(buttonId).addEventListener('click', () => {

        function injectScript(storageKey) {

            document.body.style.cursor = 'crosshair';

            document.addEventListener('click', (event) => {
                function createXPathFromElement(elm) {
                    const allNodes = document.getElementsByTagName('*');
                    for (var segs = []; elm && elm.nodeType == 1; elm = elm.parentNode)
                    {
                        if (elm.hasAttribute('id')) {
                            let uniqueIdCount = 0;
                            for (let n = 0;n  < allNodes.length; n++) {
                                if (allNodes[n].hasAttribute('id') && allNodes[n].id == elm.id) uniqueIdCount++;
                                if (uniqueIdCount > 1) break;
                            }
                            if (uniqueIdCount === 1) {
                                segs.unshift('id("' + elm.getAttribute('id') + '")');
                                return segs.join('/');
                            } else {
                                segs.unshift(elm.localName.toLowerCase() + '[@id="' + elm.getAttribute('id') + '"]');
                            }
                        } else if (elm.hasAttribute('class')) {
                            segs.unshift(elm.localName.toLowerCase() + '[@class="' + elm.getAttribute('class') + '"]');
                        } else {
                            let i = 0
                            for (i = 1, sib = elm.previousSibling; sib; sib = sib.previousSibling) {
                                if (sib.localName == elm.localName)  i++;
                            }
                            segs.unshift(elm.localName.toLowerCase() + '[' + i + ']');
                        }
                    }
                    return segs.length ? '/' + segs.join('/') : null;
                }

                event.target.style.border = "10px solid #0036FF";
                document.body.style.cursor = 'default';

                chrome.storage.sync.set({[storageKey]: createXPathFromElement(event.target)});


            }, {once: true});
        }

        chrome.tabs.executeScript({
            code: '(' + injectScript + ')(\'' + storageKey + '\');'
        });

        window.close()
    });
}

document.querySelector('form').addEventListener('submit', async (event) => {
    async function getStorageValue(key) {
        return new Promise((resolve, reject) => chrome.storage.sync.get(key, result => resolve(result)));
    }

    event.preventDefault()
    const formData = new FormData(event.target)

    const postData = {
        ...await getStorageValue('url'),
        name: formData.get('name'),
        query: formData.get('xpath_price'),
        xpath_stock: formData.get('xpath_stock'),
        stock_contains: formData.get('stock_contains'),
        stock_text: formData.get('stock_text'),
        client: formData.get('client'),
    };

    const {settings} = await getStorageValue('settings');

    fetch(`http://${settings.ip}/api/watcher`, {
        method: "POST",
        body: JSON.stringify(postData),
        headers: {
            Authorization: 'Basic ' + btoa(settings.email + ":" + settings.apiKey),
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    }).then(response => {
        console.log("Request complete! response:", response)

        if (response.status === 422) {
            response.json().then((error) => alert(Object.values(error.errors).join('\n')))
            return;
        }

        if (response.status !== 200) {
            alert(`Error: ${response.status} ${response.statusText}`)
            return;
        }

        alert('Successfully added watcher')
    });
});

function storeCurrentTabUrl() {
    chrome.tabs.query(
        {active: true, lastFocusedWindow: true, currentWindow: true},
        tabs => {
            chrome.storage.sync.set({url: tabs[0].url});
        }
    );
}

function loadPageTitle() {
    chrome.tabs.query(
        {active: true, lastFocusedWindow: true, currentWindow: true},
        tabs => {
            document.getElementById('name').value = tabs[0].title
        }
    );
}

document.getElementById('options-button').addEventListener('click', () => {
    chrome.runtime.openOptionsPage()
})

storeCurrentTabUrl();
loadPageTitle();

addUpdateStorageListenerToInput('xpath-price', 'xpathPrice')
addUpdateStorageListenerToInput('xpath-stock', 'xpathStock')
addUpdateStorageListenerToInput('stock-text', 'stockText')

setInputFromStorageKey('xpath-price', 'xpathPrice');
setInputFromStorageKey('xpath-stock', 'xpathStock');
setInputFromStorageKey('stock-text', 'stockText');

addXPathListener('price-button', 'xpathPrice');
addXPathListener('stock-button', 'xpathStock');
