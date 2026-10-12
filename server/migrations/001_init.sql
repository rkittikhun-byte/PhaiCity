-- PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
-- Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.

-- Phase 2 of the online game (docs/server/SERVER_SPEC.md section 3): players, logins, sessions, worlds,
-- provinces, claims and cloud saves.

CREATE TABLE players (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  display_name  text NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

-- One row per way a player logs in (LINE, Google); (provider, subject) is the provider's own user id
CREATE TABLE player_logins (
  provider    text NOT NULL CHECK (provider IN ('line', 'google')),
  subject     text NOT NULL,
  player_id   bigint NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  email       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (provider, subject)
);
CREATE INDEX player_logins_player ON player_logins (player_id);

-- Only the SHA-256 of a session token is stored
CREATE TABLE sessions (
  token_hash  text PRIMARY KEY,
  player_id   bigint NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);
CREATE INDEX sessions_player ON sessions (player_id);

-- The OAuth round trip: state → nonce, for ten minutes
CREATE TABLE login_attempts (
  state       text PRIMARY KEY,
  nonce       text NOT NULL,
  provider    text NOT NULL,
  expires_at  timestamptz NOT NULL
);

CREATE TABLE worlds (
  id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text NOT NULL,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'full', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The 77 provinces, copied from data/thailand-provinces.json by `npm run seed`
CREATE TABLE provinces (
  id       text PRIMARY KEY CHECK (id ~ '^TH-[0-9]{2}$'),
  name_th  text NOT NULL,
  name_en  text NOT NULL,
  region   text NOT NULL
);

CREATE TABLE province_claims (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  world_id        integer NOT NULL REFERENCES worlds (id),
  province_id     text NOT NULL REFERENCES provinces (id),
  player_id       bigint NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  city_name       text NOT NULL CHECK (char_length(city_name) BETWEEN 1 AND 40),
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  claimed_at      timestamptz NOT NULL DEFAULT now(),
  last_played_at  timestamptz NOT NULL DEFAULT now(),
  released_at     timestamptz
);
-- One ruler per province per world, and one province per player per world (two claims at the same instant:
-- exactly one succeeds). The API reports which rule a refused claim broke by these names.
CREATE UNIQUE INDEX one_ruler_per_province ON province_claims (world_id, province_id) WHERE status = 'active';
CREATE UNIQUE INDEX one_province_per_player ON province_claims (world_id, player_id) WHERE status = 'active';

-- The current save of a claim. revision grows by one on each save, so a stale device cannot overwrite a newer save.
-- Neighbours and rankings read stats only, never data.
CREATE TABLE city_saves (
  claim_id    bigint PRIMARY KEY REFERENCES province_claims (id) ON DELETE CASCADE,
  revision    integer NOT NULL CHECK (revision > 0),
  data        jsonb NOT NULL,
  stats       jsonb NOT NULL,
  flagged     boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
