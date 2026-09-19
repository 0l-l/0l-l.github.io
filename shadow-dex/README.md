# Shadow Dex

A small browser game built on the free [PokéAPI](https://pokeapi.co/). Walk a trainer through tall grass, and when a Pokémon appears at a random moment, its pixel-art sprite shows up as a black silhouette. Type its name (with autocomplete) to catch it and add a trading card to your binder.

**Play it:** open `index.html` (see "How to run" below).
**Course:** CMU 15-113, HW3: Explore an API.

## How the API is called

Shadow Dex calls PokéAPI v2 (`https://pokeapi.co/api/v2`) straight from the browser with the built-in `fetch()` function, using plain `GET` requests, so there are no libraries to install and no API key or account is needed. On load it requests `/generation?limit=50` and then each `/generation/{id}`, which return JSON objects whose `pokemon_species` array (a list of `{name, url}`) tells the game which Pokémon belong to each generation. When a shadow appears it fetches `/pokemon/{id}` (JSON with a `types` array and `sprites.front_default`, the URL of the pixel-art PNG) and `/pokemon-species/{id}` (JSON with `capture_rate`, `is_legendary`, and the English `genera` and `names`); the capture rate makes rarer Pokémon appear less often and sets each card's rarity. Every response is cached in memory so a Pokémon is requested at most once per visit, the next encounter is fetched in the background so it feels instant, and the Library loads sprites only as you scroll (at most 6 requests at a time) to stay within PokéAPI's fair-use guidelines. Caught Pokémon, score, and best streak are stored in the browser's `localStorage`, not on a server.

## How to run

Nothing to install. You need a modern browser and an internet connection.

- **Quickest:** double-click `index.html` to open it in Chrome, Firefox, Edge, or Safari.
- **Or serve it locally:** in this folder run `python3 -m http.server 8000` and visit <http://localhost:8000>.
- **API key:** none required. PokéAPI is open and keyless, so there are no secrets in this repo.

## How to play

| Where | What you do |
| --- | --- |
| Field | Walk with the arrow keys or WASD (or the on-screen D-pad on a phone). Only steps in **tall grass** can trigger an encounter, and the number of steps before one is random. |
| Catch screen | A shadow appears. Type its name and press **Catch**. You have 3 tries. Reveal hints (type, first letter, length) for a small point cost, or **Run away**. |
| Scoring | Each round is worth 100 points. Hints and wrong guesses lower it, and a streak and rarer Pokémon add bonus points. |
| Binder | Every Pokémon in the chosen generation has a slot. Caught ones become trading cards (rare and legendary ones shine). |
| Library | A free study guide: every Pokémon's sprite, name, number, and types, with search and a big view. It opens from the menu and from inside a catch. |
| Partner | Call out any Pokémon you have caught. It follows one step behind the trainer along the same path, and you can tap it for a happy reaction. |
| Generation chips | Choose which generation to hunt in (or all of them). |

## What happens when things go wrong

- **No internet or PokéAPI is down:** the field shows a "Can't reach PokéAPI" message with a **Try again** button instead of crashing. Your caught Pokémon still show in the Binder and Library.
- **Misspelled or empty guess:** the game says "Type a name first" or "That name isn't in this generation" and does not cost you a try.
- **Search with no results:** the Library says nothing matches and offers to search all generations.
- **A Pokémon with no pixel sprite in the API:** it is skipped for encounters, and the Library labels it "No pixel sprite".
- **Browser storage blocked:** the game still plays, it just cannot save your progress.

## Files

- `index.html` is the whole game (HTML, CSS, and JavaScript in one file, with all pixel art for the field drawn in code).
- `prompt_log.md` lists the AI tool used and the key prompts that shaped the game.

## Credits

- Data and sprites from [PokéAPI](https://pokeapi.co/) and the [PokeAPI/sprites](https://github.com/PokeAPI/sprites) repository.
- Fonts: Silkscreen and Figtree from Google Fonts.
- Fan-made educational project. Pokémon and its characters belong to Nintendo, Game Freak, and Creatures Inc.
