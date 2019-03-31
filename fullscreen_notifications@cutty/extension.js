const { Clutter, GLib, Shell, St } = imports.gi;
const Config = imports.misc.config;
const Main = imports.ui.main;
const MessageTray = imports.ui.messageTray;


/*
 * Patching functions.
 * https://gitlab.gnome.org/GNOME/gnome-shell-extensions/blob/master/extensions/windowsNavigator/extension.js
 */
function injectToFunction(parent, name, func) {
    let origin = parent[name];
    parent[name] = function() {
        let ret;
        ret = origin.apply(this, arguments);
        if (ret === undefined) {
            ret = func.apply(this, arguments);
        }
        return ret;
    };
    return origin;
}

function overrideFunction(parent, name, func) {
    let origin = parent[name];
    parent[name] = function() {
        return func.apply(this, arguments);
    };
    return origin;
}

function removePatch(object, injection, name) {
    if (injection[name] === undefined)
        delete object[name];
    else
        object[name] = injection[name];
}


function _hasFSNotifyHint(mutter_hints) {
    if (mutter_hints == null) {
        return false;
    }

    let hints = mutter_hints.split(':');
    for (let i = 0; i < hints.length; i++) {
        let hint = hints[i].split('=');
            if ((hint[0] == 'fsnotify') && ((hint[1] || '1') != '0')) {
                return true;
            }
    }

    return false;
}

/*
 * Version specific functions for MessageTray.
 */
function _isLimited_3_28_3() {
    if (this._busy) {
        return this._busy
    }

    if (Main.layoutManager.primaryMonitor.inFullscreen) {
        let windows = global.screen.get_active_workspace().list_windows();
        for (let i = 0; i < windows.length; i++) {
            if (windows[i].is_fullscreen() &&
                    windows[i].is_on_primary_monitor()) {
                if (_hasFSNotifyHint(windows[i].get_mutter_hints())) {
                    /* This can override if there are multiple fullscreen
                     * windows and only one has the mutter hints. */
                    return false;
                }
            }
        }
        return true;
    }
    return false;
}

function _updateState_3_28_3() {
    let hasMonitor = Main.layoutManager.primaryMonitor != null;
    this.actor.visible = !this._bannerBlocked && hasMonitor && this._banner != null;
    if (this._bannerBlocked || !hasMonitor)
        return;

    // If our state changes caused _updateState to be called,
    // just exit now to prevent reentrancy issues.
    if (this._updatingState)
        return;

    this._updatingState = true;

    // Filter out acknowledged notifications.
    let changed = false;
    this._notificationQueue = this._notificationQueue.filter(n => {
        changed = changed || n.acknowledged;
        return !n.acknowledged;
    });

    if (changed)
        this.emit('queue-changed');

    let hasNotifications = Main.sessionMode.hasNotifications;

    if (this._notificationState == MessageTray.State.HIDDEN) {
        let nextNotification = this._notificationQueue[0] || null;
        if (hasNotifications && nextNotification) {
            let limited = this._isLimited();
            let showNextNotification = (!limited || nextNotification.forFeedback || nextNotification.urgency == MessageTray.Urgency.CRITICAL);
            if (showNextNotification)
                this._showNotification();
        }
    } else if (this._notificationState == MessageTray.State.SHOWN) {
        let expired = (this._userActiveWhileNotificationShown &&
                        this._notificationTimeoutId == 0 &&
                        this._notification.urgency != MessageTray.Urgency.CRITICAL &&
                        !this._banner.focused &&
                        !this._pointerInNotification) || this._notificationExpired;
        let mustClose = (this._notificationRemoved || !hasNotifications || expired);

        if (mustClose) {
            let animate = hasNotifications && !this._notificationRemoved;
            this._hideNotification(animate);
        } else if (this._pointerInNotification && !this._banner.expanded) {
            this._expandBanner(false);
        } else if (this._pointerInNotification) {
            this._ensureBannerFocused();
        }
    }

    this._updatingState = false;

    // Clean transient variables that are used to communicate actions
    // to updateState()
    this._notificationExpired = false;
}


function getIsLimited() {
    if (Config.PACKAGE_VERSION != '3.28.3') {
        return undefined;
    }

    return _isLimited_3_28_3;
}

function getUpdateState() {
    if (Config.PACKAGE_VERSION != '3.28.3') {
        return undefined;
    }

    return _updateState_3_28_3;
}

function isVersionSupported() {
    return !(getIsLimited() === undefined) &&
            !(getUpdateState() === undefined);
}

function init() {
    if (!isVersionSupported()) {
        throw new Error('Unsupported version: ' + Config.PACKAGE_VERSION);
    }
}


let messageTrayPatches;

function resetState() {
    messageTrayPatches = {};
}

function enable() {
    resetState();

    MessageTray.MessageTray.prototype._isLimited = getIsLimited();
    messageTrayPatches['_isLimited'] = undefined;

    messageTrayPatches['_updateState'] = overrideFunction(
            MessageTray.MessageTray.prototype, '_updateState',
            getUpdateState());
}

function disable() {
    let i;

    for (i in messageTrayPatches)
        removePatch(MessageTray.MessageTray.prototype, messageTrayPatches, i);

    resetState();
}
