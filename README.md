# Places, Please

A match-three puzzle game with a theatre theme. You swap neighbouring pieces to line up three or more of a kind and clear each level's goal before the moves run out. It runs in a web browser, can be added to a phone's Home Screen, and keeps working with no internet once it has been opened one time.

It is plain JavaScript. There is nothing to install and nothing to build.

## Run it on the PC

1. Open a terminal in this folder (`C:\dev\places-please`).
2. Type:

   ```
   python -m http.server 8140
   ```

3. Open <http://localhost:8140> in a browser.
4. To stop it, click the terminal and press Ctrl+C.

## Run the tests

In a terminal in this folder:

```
npm test
```

Every line should say `pass`. Run the tests after any change.

## Settings you can edit

All the adjustable values are in the `config/` folder: prices, payouts, tier targets, board sizes, the names shown on screen, and the colors. Open a file there in any text editor, change a value, and save. Nothing outside `config/` needs to change for a settings tweak.

## The update rule

A phone keeps its own saved copy of the game, so it will not see a change until you do both of these:

1. Run this in the folder. It refreshes the list of files the phone saves:

   ```
   node tools/update-sw-list.js
   ```

2. Open `sw.js` and raise the version number in the line near the top:

   ```
   const CACHE = 'places-please-v1';
   ```

   Change `v1` to `v2`, the next time to `v3`, and so on.

Do this after changing any file, including a file in `config/`. Then run `npm test`. If step 1 was skipped, the test named "every shipped file is in the service worker list" fails and tells you so.

On the phone, close the game and open it again (sometimes twice) to get the new version.

## The app icon

The icon files in `icons/` are drawn by a script. To change the icon, edit `tools/make-icons.js`, then run:

```
node tools/make-icons.js
```

Then follow the update rule above.

## What is in the folder

- `index.html`: the page that starts the game
- `engine/`, `levels/`, `meta/`: the game rules, the levels, and progress and saving
- `ui/`: what is drawn on screen and how touches are handled
- `config/`: the settings
- `icons/`, `manifest.webmanifest`, `sw.js`: Home Screen install and offline play
- `tools/`: the two helper scripts described above
- `tests/`: the automatic checks
- `docs/`: the design and the build plan
