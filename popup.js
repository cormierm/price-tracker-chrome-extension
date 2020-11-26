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

function addPriceWatcher() {
    function getStorageValue(key) {
        return new Promise((resolve, reject) => chrome.storage.sync.get(key, result => resolve(result)));
    }
    const postData = {
        xpathPrice: document.getElementById('price-input').value,
        xpathStock: document.getElementById('stock-input').value,
        ...getStorageValue('url'),
        apiKey: 'some-key',
    };


    // fetch("/post/data/here", {
    //     method: "POST",
    //     body: JSON.stringify(data)
    // }).then(res => {
    //     console.log("Request complete! response:", res);
    // });
    console.log(postData);
}

document.getElementById('add-button').addEventListener('click', () => {
    addPriceWatcher()
});

chrome.tabs.query(
    {active: true, lastFocusedWindow: true, currentWindow: true},
    tabs => {
        chrome.storage.sync.set({url: tabs[0].url});
    }
);

addUpdateStorageListenerToInput('server-ip-input', 'serverIp')
addUpdateStorageListenerToInput('api-key-input', 'apiKey')
addUpdateStorageListenerToInput('price-input', 'xpathPrice')
addUpdateStorageListenerToInput('stock-input', 'xpathStock')

setInputFromStorageKey('server-ip-input', 'serverIp');
setInputFromStorageKey('api-key-input', 'apiKey');
setInputFromStorageKey('price-input', 'xpathPrice');
setInputFromStorageKey('stock-input', 'xpathStock');

addXPathListener('price-button', 'xpathPrice');
addXPathListener('stock-button', 'xpathStock');
