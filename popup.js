function loadInputsFromStorage() {
    chrome.storage.sync.get(['priceQuery', 'priceQueryType', 'stockQuery', 'stockQueryType', 'stockText', 'stockCondition', 'client'], function (storage) {
        console.log(storage)
        document.getElementById('price-query').value = storage.priceQuery || '';
        document.getElementById('price-query-type-xpath').checked = storage.priceQueryType === 'xpath';
        document.getElementById('price-query-type-selector').checked = storage.priceQueryType === 'selector';
        document.getElementById('price-query-type-regex').checked = storage.priceQueryType === 'regex';

        document.getElementById('stock-query').value = storage.stockQuery || '';
        document.getElementById('stock-query-type-xpath').checked = storage.stockQueryType === 'xpath';
        document.getElementById('stock-query-type-selector').checked = storage.stockQueryType === 'selector';
        document.getElementById('stock-query-type-regex').checked = storage.stockQueryType === 'regex';
        document.getElementById('stock-condition').value = storage.stockCondition;
        document.getElementById('stock-text').value = storage.stockText || '';

        document.getElementById('browsershot').checked = storage.client === 'browsershot';
        document.getElementById('curl').checked = storage.client === 'curl';
        document.getElementById('guzzle').checked = storage.client === 'guzzle';
        document.getElementById('puppeteer').checked = storage.client === 'puppeteer';
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
        price_query: formData.get('price-query'),
        price_query_type: formData.get('price-query-type'),
        stock_query: formData.get('stock-query'),
        stock_query_type: formData.get('stock-query-type'),
        stock_condition: formData.get('stock-condition'),
        stock_text: formData.get('stock-text'),
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
                priceQuery: '',
                priceQueryType: 'xpath',
                stockQuery: '',
                stockQueryType: 'xpath',
                stockText: '',
                stockCondition: 'contains_text',
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
                document.getElementById('price-query').value = res.price_query;
                document.getElementById('price-query-type-xpath').checked = res.price_query_type === 'xpath';
                document.getElementById('price-query-type-selector').checked = res.price_query_type === 'selector';
                document.getElementById('price-query-type-regex').checked = res.price_query_type === 'regex';
                document.getElementById('stock-query').value = res.stock_query;
                document.getElementById('stock-query-type-xpath').checked = res.stock_query_type === 'xpath';
                document.getElementById('stock-query-type-selector').checked = res.stock_query_type === 'selector';
                document.getElementById('stock-query-type-regex').checked = res.stock_query_type === 'regex';
                document.getElementById('stock-text').value = res.stock_text;
                document.getElementById('stock-condition').value = res.stock_condition;

                document.getElementById('browsershot').checked = res.client === 'browsershot';
                document.getElementById('curl').checked = res.client === 'curl';
                document.getElementById('guzzle').checked = res.client === 'guzzle';
                document.getElementById('puppeteer').checked = res.client === 'puppeteer';

                chrome.storage.sync.set({
                    priceQuery: res.price_query,
                    priceQueryType: res.price_query_type,
                    stockQuery: res.stock_query,
                    stockQueryType: res.stock_query_type,
                    stockText: res.stock_text,
                    stockCondition: res.stock_condition,
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
            price_query: formData.get('price-query'),
            price_query_type: formData.get('price-query-type'),
            stock_query: formData.get('stock-query'),
            stock_query_type: formData.get('stock-query-type'),
            stock_condition: formData.get('stock-condition'),
            stock_text: formData.get('stock-text'),
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

Price Inner Text: ${res.debug.value_inner_text}
Stock Inner Text: ${res.debug.stock_inner_text}
Stock Outer Html: ${res.debug.stock_outer_html}`);
            })
        }
    }).finally(() => {
        event.target.disabled = false;
    });
})

storeCurrentTabUrl();
loadPageTitle();
loadInputsFromStorage();

addUpdateStorageListenerToInput('price-query', 'priceQuery')
addUpdateStorageListenerToRadio('price-query-type-xpath', 'priceQueryType');
addUpdateStorageListenerToRadio('price-query-type-selector', 'priceQueryType');
addUpdateStorageListenerToRadio('price-query-type-regex', 'priceQueryType');

addUpdateStorageListenerToInput('stock-query', 'stockQuery')
addUpdateStorageListenerToRadio('stock-query-type-xpath', 'stockQueryType');
addUpdateStorageListenerToRadio('stock-query-type-selector', 'stockQueryType');
addUpdateStorageListenerToRadio('stock-query-type-regex', 'stockQueryType');
addUpdateStorageListenerToInput('stock-condition', 'stockCondition')
addUpdateStorageListenerToInput('stock-text', 'stockText')

addUpdateStorageListenerToRadio('browsershot', 'client');
addUpdateStorageListenerToRadio('curl', 'client');
addUpdateStorageListenerToRadio('guzzle', 'client');
addUpdateStorageListenerToRadio('puppeteer', 'client');

addXPathListener('price-button', 'priceQuery');
addXPathListener('stock-button', 'stockQuery');
