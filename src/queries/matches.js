
export async function get_matches(profile_id, matches_count) {
    if (!profile_id) return [];

    const response = await fetch(`https://data.aoe2companion.com/api/matches?profile_ids=${profile_id}`).catch((error) => {
        console.error("Get matches fetch error:", error);
    });

    if (!response?.ok) {
        console.error(`Get matches response not ok! Status: ${response?.status}`);
        return [];
    }

    const json = await response.json();

    const {matches} = json;

    if (Array.isArray(matches) || matches?.length > 0) {
        return matches;
    }

    return [];
}
