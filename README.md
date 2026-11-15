# Nightfall

Nightfall is a social deduction game you play in the browser with 3 to 7
friends. Everyone gets a secret role. During the night, some roles get to peek
at cards or swap them around. Then the sun comes up and you have one day to
argue it out and vote off a Vampire, if you can work out who it is.

It's built with React and TypeScript on the front end, and Node with Fastify
and Socket.IO on the back end.

## Playing locally

```bash
npm install
npm run dev
```

That starts the server on port 3001 and the client on port 5173. Open
http://localhost:5173 in a few browser tabs, one for each player, and you're
good to go. You'll need at least 3 players to start a game.

If you'd rather run the two halves in separate terminals, use
`npm run dev:server` and `npm run dev:client`.

## Deploying

The server and the client are deployed separately.

For the server, run `npm install` and then `npm start`, and set these
environment variables:

- `PORT`: the port to listen on. Most hosts set this for you.
- `CLIENT_ORIGIN`: the exact URL your client is served from.
- `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`: a Turso database for accounts
  and stats. If you leave these out, the server keeps everything in a local
  SQLite file at `server/data/nightfall.db`.

For the client, run `npm install && npm run build:client` and serve the
`client/dist` folder. Set `VITE_SERVER_URL` to your server's URL. It gets baked
in when the client is built, so if you change it you'll need to rebuild.

## What's where

- `shared/` holds the roles, deck building, and the event types the client and
  server both use.
- `server/` is the backend. The game logic lives in `gameEngine.ts`, rooms in
  `roomStore.ts`, accounts in `auth.ts`, and the database code in `db.ts` and
  `stats.ts`.
- `client/` is the React app, with one screen per phase of the game in
  `src/screens/`.

## The roles

There are eight roles: Vampire, Oracle, Thief, Troublemaker, Sentry, Hunter,
Jester, and Mortal. The Oracle, Thief, Troublemaker, and Jester are in every
game. The host picks the rest in the lobby: how many Vampires and Mortals, and
whether to include the Sentry and the Hunter.

There are always 3 more cards than players, and the leftover 3 sit face down in
the middle. A game has 2 Vampires (you can drop to 1 with only 3 players) and
at most 2 Mortals.

You always act as the role you were dealt at the start of the night, even if a
Thief or Troublemaker has moved your card by the time your turn comes around.

In the code, the roles still go by their classic names, like `WEREWOLF`,
`SEER`, and `ROBBER`.

## A few things to know

- Games only live in the server's memory, so if the server restarts, any games
  in progress are gone.
- Accounts are just a username and password, and your username is your name in
  the game. There's no email and no password reset, so if you forget your
  password you'll have to pick a new name.
- Your stats stick around: games played, wins and losses, Hunter accuracy,
  MVPs, win streaks, and which roles you've had.
- Logins aren't saved anywhere, so a server restart signs everyone out. Your
  account and stats are still there when you log back in.
- The server is in charge of everything. It holds the cards, checks every move,
  and only tells each player what they're allowed to know. Login attempts are
  rate limited too.
- Every night step takes the same amount of time, whether or not anyone holds
  that role, so you can't work out who's who from the timing.
- There's a text chat during the day, but no voice chat.
- Room codes look like `WOLF-4821`.

## License

MIT. See [LICENSE](LICENSE).
