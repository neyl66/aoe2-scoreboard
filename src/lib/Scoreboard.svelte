<script>
    import {onMount} from "svelte";
    import {meta} from "tinro";
    const route = meta();

    import Civilization from "./Civilization.svelte";

    const matches_url = (profile_id, matches_count) => `https://legacy.aoe2companion.com/api/player/matches?game=aoe2de&start=0&count=${matches_count}&profile_ids=${profile_id}`;
    
	const settings = {
        profile_id: parseInt(route.query?.profile_id) || 0,
        timeframe: 0,
        matches_count: {
            player: parseInt(route.query?.matches_count) || 100,
            enemy: 1000,
        },
        hours_minus: parseInt(route.query?.hours_minus) || 14,
        num_players: 2,
        from_date: route.query?.from_date || "",
        show_player_civs: route.query?.show_player_civs || "yes",
        show_enemy_civs: route.query?.show_enemy_civs || "yes",
        profile_id_enemy: 0,
        current_match_id: 0,
        periodic_check: {
            timer: 0,
            interval: 30 * 1000,
        },
	};

    const matches = {
        player: [],
        enemy: [],
    };

    const score = {
        wins: 0,
        losses: 0,
    };

    let winrate = {
        percentage: "",
        number_of_games: 0,
        profile_id_enemy: 0,
    };

    let is_loading = false;

    async function set_static_data() {
        const response = await fetch("https://app.aoe2companion.com/static/media/en.json.679e7d39.lazy");
        const {civ, game_type, leaderboard, map_size, map_type, rating_type} = await response.json();

        const prepare_data = (data) => data.reduce((data, item) => {
            data[item.id] = item.string;
            return data;
        }, {});

        // Set static data.
        settings["civs"] = prepare_data(civ);
        settings["game_type"] = prepare_data(game_type);
        settings["leaderboard"] = prepare_data(leaderboard);
        settings["map_size"] = prepare_data(map_size);
        settings["map_type"] = prepare_data(map_type);
        settings["rating_type"] = prepare_data(rating_type);
    }

    // Happens every x seconds.
    async function set_data() {
        if (is_loading) return;
        is_loading = true;
        
        // Deduct hours from current time.
        change_hours();

        // Set player matches.
        matches["player"] = await get_matches("player", settings.profile_id).then((matches) => matches.filter((match) => match.num_players === settings.num_players));

        // Set player score.
        set_score("player");

        // Get winrate against new enemy.
        if (settings.current_match_id !== matches["player"][0].match_id) {
            settings.current_match_id = matches["player"][0].match_id;

            // Set enemy matches
            matches["enemy"] = await get_matches("enemy", settings.profile_id_enemy).then((matches) => matches.filter((match) => {
                const {players, finished} = match;
                
                // Skip games based on number of players.
                if (match.num_players !== settings.num_players) return false;

                // Skip not finished games.
                if (!finished) return false;

                // Skip games without win info.
                if (players[0].won === null) return false;

                return true;
            }));
            
            // Set player winrate.
            set_winrate();
        }

        is_loading = false;
    }

    async function get_matches(type, profile_id) {
        try {
            const response = await fetch(matches_url(profile_id, settings.matches_count[type]));
            if (!response.ok) return [];

            const json = await response.json();
            return json;
        } catch (error) {
            console.error(error);
        }

        return [];
    }

    function set_score(type) {
        if (matches[type].length < 1) return;

        // Refresh score.
        score.wins = 0;
        score.losses = 0;

        // Loop through matches.
        let found_enemy = false;
        for (const match of matches[type]) {
            const {players, match_id} = match;
            const started_unix = match.started * 1000;
            const finished_unix = match.finished * 1000;

            // Get first enemy player in currently played game.
            if (!found_enemy) {
                const enemy_player = players.find((player) => player.profile_id !== settings.profile_id);
                settings.profile_id_enemy = enemy_player.profile_id;

                found_enemy = true;
            }

            // Skip not finished games.
            if (finished_unix < 1) continue;

            // Skip games that finished before our timeframe.
            if (finished_unix < settings.timeframe) continue;

            // Skip games without win info.
            if (players[0].won === null) continue;

            // Get player score.
            for (const player of players) {

                // Skip enemy players.
                if (player.profile_id !== settings.profile_id) continue;

                if (player.won) {
                    score.wins++;
                } else {
                    score.losses++;
                }
            }
        }
    }

    function set_winrate() {
        if (!settings.profile_id_enemy || matches.enemy.length < 1) return;

        // Prepare values.
        let wins = 0;
        let losses = 0;

        // Loop through enemy matches.
        for (const match of matches["enemy"]) {
            const {players} = match;

            // Get player score against current enemy.
            for (const player of players) {

                // Skip enemy players.
                if (player.profile_id !== settings.profile_id) continue;

                if (player.won) {
                    wins++;
                } else {
                    losses++;
                }
            }
        }

        // Calculate winrate percentage.
        let number_of_games = wins + losses;
        let percentage = (wins / number_of_games) * 100;

        // Convert float to 2 decimal.
        if (!Number.isInteger(percentage)) {
            percentage = percentage.toFixed(2);
        }

        // Set winrate values.
        winrate = {
            percentage,
            number_of_games,
        };
    }

    function change_hours() {
        settings.timeframe = Date.now();

        // Get time and date from url.
        if (settings.from_date) {
            // Example date: 2022.10.18-22:20
            const datetime = settings.from_date.split("-");
            const date = datetime[0].split(".");
            const time = datetime[1].split(":");

            // Create new date.
            let new_date = new Date(date);
            new_date.setHours(time[0]);
            new_date.setMinutes(time[1]);
            new_date = new Date(new_date).setMinutes(time[1]);

            // Save new date.
            settings.timeframe = new_date;
        }

        // Change hours based on hours.
        let timeframe_object = new Date(settings.timeframe);
        timeframe_object.setHours(timeframe_object.getHours() - settings.hours_minus);

        // Save new timeframe.
        settings.timeframe = Date.parse(timeframe_object);
    }

    function start_periodic_check() {
		if (settings.periodic_check.timer) return;

		// Refresh data on interval.
		settings.periodic_check.timer = setInterval(() => {
            set_data();
		}, settings.periodic_check.interval);
	}

	window.stop_periodic_check = () => {
		clearInterval(settings.periodic_check.timer);
		settings.periodic_check.timer = 0;
	}

    onMount(async () => {
        if (!settings.profile_id) return;

        set_static_data();
        set_data();
		start_periodic_check();
	});

</script>

<svelte:head>
    <link rel="stylesheet" href="/bootstrap.min.css">
</svelte:head>

<div class="scoreboard">
    <img src="./scoreboard.png" width="632" height="163" alt="scoreboard">
    <span class="score -wins" class:-double-digit={score.wins > 9}>{score.wins}</span>
    <span class="score -losses" class:-double-digit={score.losses > 9}>{score.losses}</span>

    {#if (winrate.number_of_games > 0) }
        <div class="winrate-container">
            <span class="winrate-percentage">{winrate.percentage}%</span>
            
            <svg class="winrate-trophy" xmlns="http://www.w3.org/2000/svg" width="21" height="21" viewBox="0 0 24 24">
                <path fill="#fff" d="M5 0c0 9.803 5.105 12.053 5.604 16h2.805c.497-3.947 5.591-6.197 5.591-16h-14zm7.006 14.62c-.408-.998-.969-1.959-1.548-2.953-1.422-2.438-3.011-5.162-3.379-9.667h9.842c-.368 4.506-1.953 7.23-3.372 9.669-.577.993-1.136 1.954-1.543 2.951zm-.006-3.073c-1.125-2.563-1.849-5.599-1.857-8.547h-1.383c.374 3.118 1.857 7.023 3.24 8.547zm12-9.547c-.372 4.105-2.808 8.091-6.873 9.438.297-.552.596-1.145.882-1.783 2.915-1.521 4.037-4.25 4.464-6.251h-2.688c.059-.45.103-.922.139-1.405h4.076zm-24 0c.372 4.105 2.808 8.091 6.873 9.438-.297-.552-.596-1.145-.882-1.783-2.915-1.521-4.037-4.25-4.464-6.251h2.688c-.058-.449-.102-.922-.138-1.404h-4.077zm13.438 15h-2.866c-.202 1.187-1.63 2.619-3.571 2.619v4.381h10v-4.381c-1.999 0-3.371-1.432-3.563-2.619zm2.562 6h-8v-2h8v2z"></path>
            </svg>
            
            <span class="number-of-players">({winrate.number_of_games})</span>
        </div>
    {/if}

    {#if (settings.show_player_civs === "yes" && matches.player.length > 0) }
        <div class="player-civs -player">
            {#each matches.player.slice(1) as match, index (match.match_id)}
                <Civilization {match} {index} profile_id={settings.profile_id} civs={settings.civs} type="player" />
            {/each}
        </div>
    {/if}

    {#if (settings.show_enemy_civs === "yes" && matches.enemy.length > 0) }
        <div class="player-civs -enemy">
            {#each matches.enemy as match, index (match.match_id)}
                <Civilization {match} {index} profile_id={settings.profile_id_enemy} civs={settings.civs} type="enemy" />
            {/each}
        </div>
    {/if}
</div>

<style>
    .scoreboard {
        display: inline-block;
        position: relative;
    }
    .scoreboard .score {
        color: white;
        font-size: 1.8rem;
        position: absolute;
        top: 50%;
        left: 50%;
    }
    .scoreboard .score.-double-digit {
        font-size: 1.5rem;
    }
    .scoreboard .score.-wins {
        transform: translate(-50px, -50%);
    }
    .scoreboard .score.-wins.-double-digit {
        transform: translate(-55px, -50%);
    }
    .scoreboard .score.-losses {
        transform: translate(32px, -50%);
    }
    .scoreboard .score.-losses.-double-digit {
        transform: translate(27px, -50%);
    }

    .winrate-container {
        position: absolute;
        top: 122px;
        left: 50%;
        transform: translateX(-50%);
        background: black;
        border: 3px solid #f4766e;
        padding: 5px;
    }
    .winrate-container span {
        color: white;
        font-size: 19px;
        display: inline-block;
        vertical-align: middle;
    }
</style>