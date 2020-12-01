function loadInputsFromStorage() {
    chrome.storage.sync.get(['xpathPrice', 'xpathStock', 'stockText', 'stockContains', 'client'], function (storage) {
        console.log(storage)
        document.getElementById('xpath-price').value = storage.xpathPrice || '';
        document.getElementById('xpath-stock').value = storage.xpathStock || '';
        document.getElementById('stock-text').value = storage.stockText || '';
        document.getElementById('contains').checked = storage.stockContains === "true";
        document.getElementById('does-not-contain').checked = storage.stockContains === "false";
        document.getElementById('browsershot').checked = storage.client === 'browsershot' ? true : false;
        document.getElementById('curl').checked = storage.client === 'curl' ? true : false;
        document.getElementById('guzzle').checked = storage.client === 'guzzle' ? true : false;
    });
}

function addUpdateStorageListenerToInput(elementId, storageKey) {
    document.getElementById(elementId).addEventListener('input', (event) => {
        chrome.storage.sync.set({[storageKey]: event.target.value});
    });
}

function addUpdateStorageListenerToRadio(elementId, storageKey) {
    document.getElementById(elementId).addEventListener('change', (event) => {
        console.log(event.target.value)
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
                    for (var segs = []; elm && elm.nodeType == 1; elm = elm.parentNode) {
                        if (elm.hasAttribute('id')) {
                            let uniqueIdCount = 0;
                            for (let n = 0; n < allNodes.length; n++) {
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
                                if (sib.localName == elm.localName) i++;
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
    event.preventDefault()

    async function getStorageValue(key) {
        return new Promise((resolve, reject) => chrome.storage.sync.get(key, result => resolve(result)));
    }

    const {settings} = await getStorageValue('settings');

    const formData = new FormData(event.target)

    const postData = {
        ...await getStorageValue('url'),
        name: formData.get('name'),
        query: formData.get('xpath_price'),
        xpath_stock: formData.get('xpath_stock'),
        stock_contains: formData.get('stock_contains') === 'true',
        stock_text: formData.get('stock_text'),
        client: formData.get('client'),
        interval_id: formData.get('interval_id'),
    };

    fetch(`http://${settings.ip}/api/watcher`, {
        method: "POST",
        body: JSON.stringify(postData),
        headers: {
            Authorization: 'Basic ' + btoa(settings.email + ":" + settings.apiKey),
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    }).then(response => {
        if (response.status === 422) {
            response.json().then((error) => alert('Validation error:\n' + Object.values(error.errors).join('\n')))
        } else if (response.status !== 200) {
            alert(`Error: ${response.status} ${response.statusText}`)
        } else {
            alert('Successfully added watcher')

            chrome.storage.sync.set({
                xpathPrice: '',
                xpathStock: '',
                stockText: '',
                stockContains: true,
                client: 'browsershot'
            });

            window.close()
        }
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

document.getElementById('auto-fill').addEventListener('click', async () => {
    async function getStorageValue(key) {
        return new Promise((resolve, reject) => chrome.storage.sync.get(key, result => resolve(result)));
    }

    const {settings} = await getStorageValue('settings');
    fetch(`http://${settings.ip}/api/template/search-by-url`, {
        method: "POST",
        body: JSON.stringify({
            ...await getStorageValue('url'),
        }),
        headers: {
            Authorization: 'Basic ' + btoa(settings.email + ":" + settings.apiKey),
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    }).then(response => {
        if (response.status === 404) {
            alert('No template found or server ip is not configured properly.')
        } else if (response.status === 422) {
            response.json().then((error) => alert('Validation error:\n' + Object.values(error.errors).join('\n')))
        } else if (response.status !== 200) {
            alert(`Error: ${response.status} ${response.statusText}`)
        } else {
            response.json().then((res) => {
                document.getElementById('xpath-price').value = res.xpath_value;
                document.getElementById('xpath-stock').value = res.xpath_stock;
                document.getElementById('stock-text').value = res.stock_text;
                document.getElementById('contains').checked = res.stock_contains;
                document.getElementById('does-not-contain').checked = !res.stock_contains;
                document.getElementById('browsershot').checked = res.client === 'browsershot' ? true : false;
                document.getElementById('curl').checked = res.client === 'curl' ? true : false;
                document.getElementById('guzzle').checked = res.client === 'guzzle' ? true : false;

                chrome.storage.sync.set({
                    xpathPrice: res.xpath_value,
                    xpathStock: res.xpath_stock,
                    stockText: res.stock_text,
                    stockContains: res.stock_contains ? 'true' : 'false',
                    client: res.client,
                });
            })
        }
    });
})

document.getElementById('check-button').addEventListener('click', async (event) => {
    async function getStorageValue(key) {
        return new Promise((resolve, reject) => chrome.storage.sync.get(key, result => resolve(result)));
    }

    const {settings} = await getStorageValue('settings')

    const formData = new FormData(document.querySelector('form'))

    event.target.disabled = true;

    fetch(`http://${settings.ip}/api/watcher/check`, {
        method: "POST",
        body: JSON.stringify({
            ...await getStorageValue('url'),
            xpath_value: formData.get('xpath_price'),
            xpath_stock: formData.get('xpath_stock'),
            stock_contains: formData.get('stock_contains') === 'true',
            stock_text: formData.get('stock_text'),
            client: formData.get('client'),
        }),
        headers: {
            Authorization: 'Basic ' + btoa(settings.email + ":" + settings.apiKey),
            'Content-Type': 'application/json',
            Accept: 'application/json'
        }
    }).then(response => {
        if (response.status === 422) {
            response.json().then((error) => alert('Validation error:\n' + Object.values(error.errors).join('\n')))
        } else if (response.status !== 200) {
            alert(`Error: ${response.status} ${response.statusText}`)
        } else {
            response.json().then((res) => {
                alert(`Found the following information:
                
Price: ${res.value}
Has Stock: ${res.has_stock}

XPath Query Price InnerText: ${res.raw_value}
XPath Query Stock InnerText: ${res.raw_stock_value}`);
            })
        }
    }).finally(() => {
        event.target.disabled = false;
    });
})

storeCurrentTabUrl();
loadPageTitle();
loadInputsFromStorage();

addUpdateStorageListenerToInput('xpath-price', 'xpathPrice')
addUpdateStorageListenerToInput('xpath-stock', 'xpathStock')
addUpdateStorageListenerToInput('stock-text', 'stockText')

addUpdateStorageListenerToRadio('browsershot', 'client');
addUpdateStorageListenerToRadio('curl', 'client');
addUpdateStorageListenerToRadio('guzzle', 'client');
addUpdateStorageListenerToRadio('contains', 'stockContains');
addUpdateStorageListenerToRadio('does-not-contain', 'stockContains');

addXPathListener('price-button', 'xpathPrice');
addXPathListener('stock-button', 'xpathStock');
