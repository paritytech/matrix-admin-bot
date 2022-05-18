# Matrix Admin bot uses [matrix-bot-sdk](https://www.npmjs.com/package/matrix-bot-sdk)

This bot helps to keep the matrix channels maintainable and implements functionality 
which runs bulk invite to the channels new users     
Initial [tool request](https://github.com/paritytech/opstooling/issues/14)
Eng requirements [doc](https://docs.google.com/document/d/1wOUP6AX4XKBzaeu8MKgm269DaUg2FGwjBQ7RQpKarQY/edit)

## Running / Building

2. Update your project's details in `package.json`.
3. Run `yarn install` to get the dependencies.

To build it: `yarn build`.

To run it: `yarn start:dev`

To check the lint: `yarn lint`

To build the Docker image: `docker build -t your-bot:latest .`

To run the Docker image (after building): `docker run --rm -it your-bot:latest`

### Configuration

`$ cp .env.example .env`

## Project structure

### `src/bot.ts`

This is where the bot's entry point is. Here you can see it reading the config, preparing the storage,
and setting up other stuff that it'll use throughout its lifetime. Nothing in here should really require
modification - most of the bot is elsewhere.

### `src/commands/handler.ts`

When the bot receives a command (see `bot.ts` for handoff) it gets processed here. The command structure
is fairly manual, but a basic help menu and processing for a single command is there.

### `src/commands/hello.ts`

This is the bot's `!adminbot hello` command. It doesn't do much, but it is an example.


### `build/`

This is where the project's build files go. Not really much to see here.

### `storage/`

This is the default storage location. Also not much to see here.

## Help!

Come visit us in [#matrix-bot-sdk:t2bot.io](https://matrix.to/#/#matrix-bot-sdk:t2bot.io) on Matrix if you're
having trouble with this template.

## Credits

Credit to anoa's [matrix-nio template](https://github.com/anoadragon453/nio-template) for the README format.
