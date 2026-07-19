# Meow Night Diner

> A cozy pixel-art restaurant management game where a cat owner grows a moonlit street-food stall through 30 increasingly demanding stages.

## Play the Game

[Play Meow Night Diner in your browser](https://junn0s.github.io/Meow/)

The game runs directly in a modern desktop or mobile browser. No installation is required.

## Gameplay

### Sunset

![Meow Night Diner gameplay during sunset](docs/screenshots/gameplay-sunset.png)

Warm sunset colors fill the stall before the blue neon lights take over.

### Night

![Meow Night Diner gameplay at night](docs/screenshots/gameplay-night.png)

At night, neon signs, rain reflections, and cool blue lighting transform the diner.

## About the Game

Serve customers, cook and deliver their orders, then reinvest the earnings in food prices, cooking speed, seats, chefs, servers, fever bonuses, and the diner itself. The early stages teach the core loop quickly, while later stages introduce larger orders, VIP customers, rush periods, and increasingly expensive upgrades.

Key features include:

- 30 progression stages with six visual tiers
- Six unlockable dishes with separate price and cooking-speed upgrades
- Expandable seating and automatic chef and server workers with same-dish parallel cooking
- A persistent owner-cat color shop with purchasable and equipable styles
- Persistent facility upgrades for cooking speed, patience, seating, revenue, and decor
- Day, sunset, night, and dawn transitions during active play
- Phase-aware lo-fi playlists for the menu, day, sunset, night, and dawn
- Fever time, menu promotions, customer rushes, combos, tips, and VIP bonuses
- Six fame tiers that expand the diner visuals and add up to a 10% revenue bonus
- Local save data and capped offline earnings
- Keyboard, mouse, and mobile touch controls

## Controls

### Desktop

| Action | Control |
| --- | --- |
| Move the owner cat | `WASD` or arrow keys |
| Take an order, pick up food, or serve | `Space` |
| Pause or open settings | `Esc` |
| Save immediately | Open settings, then select `지금 저장` |
| Toggle sound effects | `M` |
| Use menus and buy upgrades | Mouse click |

### Mobile

| Action | Control |
| --- | --- |
| Move the owner cat | Hold the on-screen directional pad |
| Take an order, pick up food, or serve | Tap the round action button |
| Pause or open settings | Tap the pause button |
| Save immediately | Open settings, then tap `지금 저장` |
| Use menus and buy upgrades | Tap the desired button |

Before hiring workers, the owner cat handles orders and serving manually. Each chef manages one cooking task at a time, while each server independently delivers a ready dish to any compatible waiting customer.

## Source Directory

```text
src/
├── main.ts                 # Phaser bootstrap and browser control bindings
├── styles.css              # Responsive page layout and mobile touch UI
├── debug.d.ts              # Types for the optional browser debug API
├── vite-env.d.ts           # Vite environment type declarations
├── game/
│   ├── art/                # Pixel textures, decor, atmosphere, and presentation
│   ├── audio/              # Sound effects and day/night ambience
│   ├── data/               # Menu, customer, progression, upgrade, and visual data
│   ├── economy/            # Currency formatting and economy calculations
│   ├── entities/           # Player, customers, tables, and cooking stations
│   ├── input/              # Pointer and touch input state management
│   ├── scenes/             # Boot, menu, gameplay, and result scenes
│   ├── systems/            # Progression, saves, service flow, upgrades, and time
│   └── types/              # Shared game state and TypeScript contracts
└── ui/                     # HUD, buttons, toast messages, and upgrade panel
```

### Main Modules

| Path | Responsibility |
| --- | --- |
| `src/game/scenes/GameScene.ts` | Runs the restaurant loop, customers, workers, interactions, rushes, and payments. |
| `src/game/data/progressionData.ts` | Defines the 30-stage progression curve and worker unlocks. |
| `src/game/systems/ProgressionSystem.ts` | Applies purchases, menu levels, fever progression, and stage completion rules. |
| `src/game/systems/ServiceFlowRules.ts` | Controls customer capacity, arrival flow, and valid food recipients. |
| `src/game/systems/CookingFlowRules.ts` | Enforces kitchen slot capacity and one simultaneous task per chef. |
| `src/game/systems/DayNightController.ts` | Advances the active-play clock through day, sunset, night, and dawn. |
| `src/game/input/TouchControls.ts` | Converts held mobile buttons into continuous movement and actions. |
| `src/ui/UpgradePanel.ts` | Displays the current progression goal and handles upgrade purchases. |

## Run Locally

Node.js 20 or newer is recommended.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite in your browser.

## Production Checks

```bash
npm run typecheck
npm run test:foundation
npm run simulate:balance
npm run build
npm run test:release
```

The production client is generated in `dist/client`. GitHub Pages deployment is configured through the repository workflow, and Vite uses a relative base path so assets work under the repository URL.

## Additional Documentation

- [30-Stage Economy, Balance, and Design Specification](docs/30-stage-economy-balance-design.md)
- [Game Description](docs/game-description.md)
- [AI Usage Report](docs/ai-usage-report.md)
- [Assets and Licenses](docs/asset-licenses.md)

All pixel textures are generated with Phaser Graphics, while short sound effects and room tone are synthesized with the Web Audio API. The lo-fi background playlist is stored as optimized Opus audio; attribution and asset notes are documented in [Assets and Licenses](docs/asset-licenses.md).
