# 0l-l.github.io

Portfolio of Oulan Li: [0l-l.github.io](https://0l-l.github.io)

## Shadow Dex (CMU 15-113, HW3: Explore an API)

**Play it:** [0l-l.github.io/shadow-dex/](https://0l-l.github.io/shadow-dex/) &middot; **Code and full README:** [`shadow-dex/`](shadow-dex/README.md) &middot; **Prompt log:** [`shadow-dex/prompt_log.md`](shadow-dex/prompt_log.md)

A walk-around Pokémon game: walk through tall grass, a shadow appears at a random moment, and typing its name catches it for your card binder.

**How the API is called.** Shadow Dex calls PokéAPI v2 (`https://pokeapi.co/api/v2`) straight from the browser with the built-in `fetch()` function, using plain `GET` requests, so there are no libraries to install and no API key or account is needed. On load it requests `/generation?limit=50` and then each `/generation/{id}`, which return JSON objects whose `pokemon_species` array (a list of `{name, url}`) tells the game which Pokémon belong to each generation. When a shadow appears it fetches `/pokemon/{id}` (JSON with a `types` array and `sprites.front_default`, the URL of the pixel-art PNG) and `/pokemon-species/{id}` (JSON with `capture_rate`, `is_legendary`, and the English `genera` and `names`); the capture rate makes rarer Pokémon appear less often and sets each card's rarity. Every response is cached in memory, the next encounter is fetched in the background, and the Library loads sprites only as you scroll (at most 6 requests at a time).

**How to run.** Nothing to install and no API key (so there are no secrets in this repo). Open the live link above, or open `shadow-dex/index.html` in a browser, or run `python3 -m http.server 8000` in this folder and visit <http://localhost:8000/shadow-dex/>.
