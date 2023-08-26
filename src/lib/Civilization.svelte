<script>
    export let match = {};
    export let profile_id = 0;
    export let type = "";
    export let index = 0;

    $: left_px = get_left_px(index);

    const player = Object.values(match.teams.find((team) => team.players.find((player) => player.profileId === profile_id)).players).find((player) => player.profileId === profile_id) || {};
    const {civImageUrl, won} = player;

    function get_left_px(index) {
        let left_px_start = 0;
        const left_px_step = 30;

        if (type == "player") {
            left_px_start = 10;

            if (index === 0) {
                return left_px_start;
            } else {
                return left_px_start + (index * left_px_step);
            }

        } else if (type == "enemy") {
            left_px_start = 380;

            if (index === 0) {
                return left_px_start;
            } else {
                return left_px_start + (index * left_px_step);
            }

        }
    }

</script>

{#if (index < 8 && player && civImageUrl) }
    <img src={civImageUrl} class="player-civ {(won) ? '-won' : '-lost'}" width="30" height="30" alt="" style:left={`${left_px}px`}>
{/if}

<style>
    .player-civ {
        width: 30px;
        height: auto;
        position: absolute;
        top: 103px;
        left: 10px;
        filter: drop-shadow(1px 1px 0px black) drop-shadow(-1px -1px 0 black);
    }
    .player-civ.-won {
        filter: drop-shadow(1px 1px 0px green) drop-shadow(-1px -1px 0 green);
    }
    .player-civ.-lost {
        filter: drop-shadow(1px 1px 0px red) drop-shadow(-1px -1px 0 red);
    }
</style>