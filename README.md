# Show GNOME notifications over fullscreen applications
### Note: This is only tested using Xorg (not Wayland)


## Installation instructions
```
mkdir -p $HOME/.local/share/gnome-shell/extensions
git clone https://github.com/cutty/gnome-shell-extensions.git
cp -r gnome-shell-extensions/fullscreen_notifications@cutty \
    $HOME/.local/share/gnome-shell/extensions
gnome-shell-extension-tool -e fullscreen_notifications@cutty
```

## Check mutter hints
This may return `_MUTTER_HINTS:  not found.`
```
xprop -id $(xprop -root _NET_ACTIVE_WINDOW | awk '{print $5}') _MUTTER_HINTS
```

## Set mutter hints for window
```
xprop -id $(xprop -root _NET_ACTIVE_WINDOW | awk '{print $5}') \
    -f _MUTTER_HINTS 8u -set _MUTTER_HINTS fsnotify
```

## To test
- Open terminal and fullscreen (f11)
- `notify-send Hello!`
- Shouldn't see anything
- Enable hints using command above
- `notify-send Hello again!`
- You should see both notification since the first is waiting in the queue


## Description
The GNOME shell will inhibit notifications under certain conditions. This
includes fullscreen applications (different than maximized). I spend quite a
bit of time in fullscreened tmux and would like get notifications for things
like emails, calendar events, song, ect.

To only enable this for specific applications the extension checks the mutter
hints for the presence of fsnotify before showing the notification.

The extension overwrites the messageTray _update_state function which is
coupled enough to the rest of the ui code that it does the patching for 3.28.3.
This is the current version on Ubuntu 18.04.  It should be pretty easy to port
this over to newer versions.
