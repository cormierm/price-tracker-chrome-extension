const defaultSettings = {
    settings: {
        ip: '',
        email: '',
        apiKey: ''
    }
}

function loadSettings() {
    chrome.storage.sync.get('settings', result => {
        result = {
            ...defaultSettings,
            ...result
        }
        
        document.getElementById('server-ip').value = result.settings.ip
        document.getElementById('email').value = result.settings.email
        document.getElementById('api-key').value = result.settings.apiKey
    })
}

const form = document.querySelector('form');
form.addEventListener('submit', (event) => {
    event.preventDefault()
    const formData = new FormData(event.target)

    const payload = {
        settings: {
            ip: formData.get('server-ip'),
            email: formData.get('email'),
            apiKey: formData.get('api-key')
        }
    }

    chrome.storage.sync.set(payload);

    window.close()
});

window.addEventListener('DOMContentLoaded', () => {
    loadSettings();
})
