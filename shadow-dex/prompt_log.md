# Prompt log: Shadow Dex (HW3)

## AI tool used

- **Claude** (Anthropic), used through the Claude desktop app in its Cowork mode. The session was configured for the model `claude-sonnet-5` (the exact serving model can differ from the configured one).
- Claude wrote the code and tested it in a headless browser (Playwright). Its workspace could not reach pokeapi.co, so its tests ran against a mock that copies PokéAPI's response format. The real PokéAPI calls were checked by running the game in my own browser.

Prompts are quoted as I typed them (typos included). Before building, Claude asked me multiple-choice questions, and my answers are noted under each prompt because they shaped the design.

## 1. The original idea: a silhouette quiz

> hi, i would like to make a game that's a quiz for pokemon. You see a poke mon's pixel art sprite as a black silhouette and guees the name. You can pick a generation ,get hints like type or first letter, and keep a score and streak. You should use poke API.

Choices I made when asked: type the answer with autocomplete; save best score and streak; hint point penalties; a skip/give-up button; reveal the colored sprite and Pokédex number after answering.

**Result:** a one-page quiz that loads generations, names, types, and pixel sprites from PokéAPI, shows the sprite as a black silhouette with a CSS filter, and tracks score and streak.

## 2. Making sure a real API is used

> what are some API that won't be blocked by you? cuz i have to have a real API at the end for my website assignment

**Result:** Claude explained that only its own workspace was blocked from reaching pokeapi.co, not my browser. We kept PokéAPI, and the game calls it live with `fetch()` when opened in a browser.

## 3. From flashcard quiz to a game scene

> I would like to have a game scene rather than a flashcard memorized like quiz thing, which is not so intuitive and immersive. So i want it to have more fun. so you are going to make a scene that makes people first be able to catch something in a grass justl like the game pokewon, and they the shadow will show up, they need to enter the right name to gain it. It will be collected in their libaray or card collection somewhere on the website. the time that theres pokemon showed up should be random.

Choices I made when asked: walk a trainer with the keyboard plus an on-screen D-pad; three tries then it runs away; a trading-card binder with empty Pokédex slots; generation picker, rarity from PokéAPI's capture rate, score and streak, and 8-bit sound effects.

**Result:** a tile-based tall-grass field drawn on a canvas, encounters that trigger after a random number of steps in tall grass, a catch screen, and a card binder saved in `localStorage`. Rarity uses `capture_rate` and `is_legendary` from the `/pokemon-species/{id}` endpoint.

## 4. A study library

> add another feature: have a 'libaray' that they can know how each one looks like and their name to learn any time they want, unless the time that they catch it. it can increase the joy and make it easier.

Choices I made when asked: it should be free to open even during a catch; each entry shows the sprite, name, number, and types, with a tap-for-big-view; search by name.

**Result:** a Library screen that lazy-loads sprites as you scroll (limited concurrent requests, cached in memory) so it does not flood the API.

## 5. A partner Pokémon

> add a feature that the player can called one of their pokemon out, accompany with them. The pokemon will follow their movement

Choices I made when asked: a "Partner" button on the field screen that opens a picker of caught Pokémon; the partner follows one step behind like in the games; tapping it gives a happy reaction.

**Result:** a follower that steps onto the tile the trainer just left, so it walks the same path.

## 6. Size adjustment

> make the partner a bit smaller please, it should be the same size as the trainer

**Result:** the partner sprite is now capped to the trainer's height.

## Verifying the code myself

The endpoints used are `/generation`, `/generation/{id}`, `/pokemon/{id}`, and `/pokemon-species/{id}` (documentation: <https://pokeapi.co/docs/v2>). Fill this in after you have actually done each check, and delete any line you did not do:

- [ ] Compared the endpoints and field names above with the PokéAPI documentation.
- [ ] Opened the game in my own browser and saw the requests to `pokeapi.co` return status 200 in the Network tab.
- [ ] Tried to break it: Wi-Fi off, an empty or misspelled guess, and a Library search with no results.
