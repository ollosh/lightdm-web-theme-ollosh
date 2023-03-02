window.addEventListener('DOMContentLoaded', async (event) => {
    await landingPage()

    loginPage()
})

/*********
 * PAGES *
 *********/
async function landingPage() {
    const body = document.querySelector('body')

    body.classList.remove('landing')

    await delay(600)

    body.classList.add('login')
}

function loginPage() {
    updateUserAndSession()

    //watch brightness
    updateBrightness()
    window.lightdm.brightness_update.connect(() => {
        updateBrightness()
    });

    //watch battery
    updateBattery()
    //since it seems like battery_update is not quite reliable, we're polling every 5 seconds in hope battery state changes
    setInterval(updateBattery, 5000)
    window.lightdm.battery_update.connect(() => {
        updateBattery()
    });

    //watch datetime
    updateDateTime()
    setInterval(updateDateTime, 5000)

    //add power menu
    addPowerMenu()

    //watch authentication
    authentication()
}

/***********
 * CONTENT *
 ***********/
function updateUserAndSession() {
    const user = getUser()
    document.querySelector('#user').innerHTML = user.display_name

    const desktop_env = getDesktopEnv()
    document.querySelector('#desktop-env').innerHTML = desktop_env.name

    //caps lock warning
    document.addEventListener('keydown', (event) => {
        let isCapsLockOn = event.getModifierState && event.getModifierState('CapsLock')

        if (event.code === 'CapsLock') {
            isCapsLockOn = !isCapsLockOn
        }

        const passwordField = document.querySelector('#password')

        if (isCapsLockOn) {
            passwordField.classList.add('caps-lock')
        } else {
            passwordField.classList.remove('caps-lock')
        }
    })
}

function updateBrightness() {
    const BRIGHTNESS_ICONS = ['mdi-brightness-5', 'mdi-brightness-6', 'mdi-brightness-7']

    const brightness_icon = getIcon(window.lightdm.brightness, BRIGHTNESS_ICONS)

    document.querySelector('#brightness').innerHTML = `<i class="mdi ${brightness_icon}"></i>`
}

function updateBattery() {
    const BAT_ICONS = ['mdi-battery-outline', 'mdi-battery-low', 'mdi-battery-medium', 'mdi-battery-high']
    const BAT_CHARGING_ICONS = ['mdi-battery-charging-outline', 'mdi-battery-charging-low', 'mdi-battery-charging-medium', 'mdi-battery-charging-high']

    const { level, ac_status } = window.lightdm.battery_data

    const bat_icons = ac_status ? BAT_CHARGING_ICONS : BAT_ICONS

    const bat_icon = getIcon(level, bat_icons)

    document.querySelector('#battery').innerHTML = `<i class="mdi ${bat_icon}"></i> ${level}%`
}

function updateDateTime() {
    const now = new Date()

    let date = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(now) + ', '
    date += new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(now)
    document.querySelector('#date').innerHTML = date

    const time = new Intl.DateTimeFormat('en-GB', { timeStyle: 'medium' }).format(now)
    document.querySelector('#time').innerHTML = time
}

function addPowerMenu() {
    document.querySelector('#power-toggle').addEventListener('click', () => {
        togglePower()
    })

    document.querySelector('#suspend').addEventListener('click', async () => {
        showPowerMessage('Suspending the system...')

        await delay(2000)

        window.lightdm.suspend()

        await delay(5000)

        await resetToLanding()
    })

    document.querySelector('#restart').addEventListener('click', async () => {
        showPowerMessage('Restarting the system...')

        await delay(2000)

        window.lightdm.restart()
    })

    document.querySelector('#shutdown').addEventListener('click', async () => {
        showPowerMessage('Shutting down the system...')

        await delay(2000)

        window.lightdm.shutdown()
    })
}
function authentication() {
    const MAX_LOGINS = 3
    let loginAttempts = MAX_LOGINS

    const statusField = document.querySelector('#status')
    const passwordInput = document.querySelector("#password input")

    const user = getUser()
    const desktopEnv = getDesktopEnv()

    window.lightdm.authentication_complete.connect(async () => {
        statusField.classList.remove('spinning')

        if (window.lightdm.is_authenticated) {
            statusField.classList.add('success')
            statusField.innerHTML = '<i class="mdi mdi-account-check"></i>'

            await delay(1000)

            window.lightdm.start_session(desktopEnv.key)
        } else {
            window.lightdm.cancel_authentication()
            loginAttempts--

            statusField.classList.add('alert')

            if (loginAttempts === 0) {
                statusField.innerHTML = '<i class="mdi mdi-account-cancel" title="Wrong password was entered ' + MAX_LOGINS + ' times. Wait for 10 minutes and try again."></i>'

                //wait 10 minutes before enabling the form again
                await delay(1000 * 60 * 10)

                statusField.classList.remove('alert')
                statusField.innerHTML = ''
            } else {
                statusField.innerHTML = '<i class="mdi mdi-account-alert" title="Wrong password. Tries left: ' + loginAttempts + '"></i>'
            }

            passwordInput.disabled = false
            passwordInput.value = ''
            passwordInput.focus()
        }
    });

    document.querySelector('#login-form').addEventListener('submit', async (e) => {
        if (loginAttempts <= 0) {
            return
        }

        e.preventDefault();

        passwordInput.blur()
        passwordInput.disabled = true
        statusField.classList.remove('alert')
        statusField.classList.add('spinning')
        statusField.innerHTML = '<i class="mdi mdi-loading"></i>'

        window.lightdm.authenticate(user.display_name);

        //since lightdm.authenticate is a more of an async method we have to wait a bit before submitting the password
        await delay(1000)

        window.lightdm.respond(passwordInput.value)
    });
}

/***********
 * HELPERS *
 ***********/
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

function getIcon(level, icons) {
    const interval = 100/icons.length
    const index = Math.floor(level/interval)

    return Math.floor(index) >= icons.length ? icons[icons.length - 1] : icons[index]
}

function getDesktopEnv() {
    return window.lightdm.sessions[0]
}

function getUser() {
    return window.lightdm.users[0]
}

function togglePower() {
    document.querySelector('#content').classList.toggle('power-menu')
}

function showPowerMessage(message) {
    document.querySelector('#power-menu .power-options').style.display = 'none'

    const powerMessageElement = document.querySelector('#power-menu .power-message')

    powerMessageElement.innerHTML = message
    powerMessageElement.style.display = 'block'
}

async function resetToLanding() {
    togglePower()

    await delay(300)

    document.querySelector('#power-menu .power-options').style.display = ''
    document.querySelector('#power-menu .power-message').style.display = 'none'

    const passwordInput = document.querySelector("#password input")
    const statusField = document.querySelector('#status')

    passwordInput.disabled = false
    passwordInput.value = ''
    passwordInput.focus()

    statusField.classList.remove('alert')
    statusField.innerHTML = ''
}
