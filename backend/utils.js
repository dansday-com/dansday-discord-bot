




export function separateChannelsAndCategories(guildChannels) {

    const channelsArray = Array.from(guildChannels.values());

    const isThreadType = (type) => {

        if (typeof type === 'number') {
            return type === 11 || type === 12 || type === 13;
        }

        if (typeof type === 'string') {
            return type === 'GUILD_PUBLIC_THREAD' ||
                type === 'GUILD_PRIVATE_THREAD' ||
                type === 'GUILD_NEWS_THREAD';
        }
        return false;
    };

    const isCategoryType = (type) => {
        if (typeof type === 'number') {
            return type === 4;
        }
        if (typeof type === 'string') {
            return type === 'GUILD_CATEGORY';
        }
        return false;
    };

    const isTextOrNewsType = (type) => {
        if (typeof type === 'number') {
            return type === 0 || type === 5;
        }
        if (typeof type === 'string') {
            return type === 'GUILD_TEXT' || type === 'GUILD_NEWS';
        }
        return false;
    };

    const allChannels = channelsArray.filter(ch => {

        const isThreadMethod = ch.isThread ? ch.isThread() : false;

        const isThreadByType = isThreadType(ch.type);

        return !isThreadMethod && !isThreadByType;
    });

    const categories = allChannels.filter(ch => {
        return isCategoryType(ch.type);
    });


    const channels = allChannels.filter(ch => {
        return isTextOrNewsType(ch.type);
    });

    return { categories, channels };
}

export function mapCategoriesForSync(categories) {
    return categories.map(cat => ({
        id: cat.id,
        name: cat.name,
        position: cat.position !== undefined ? cat.position : null
    }));
}

export function mapChannelsForSync(channels) {
    return channels.map(ch => {

        let typeValue = ch.type;
        if (typeof ch.type === 'number') {

            const typeMap = {
                0: 'GUILD_TEXT',
                1: 'DM',
                2: 'GUILD_VOICE',
                3: 'GROUP_DM',
                4: 'GUILD_CATEGORY',
                5: 'GUILD_NEWS',
                10: 'GUILD_NEWS_THREAD',
                11: 'GUILD_PUBLIC_THREAD',
                12: 'GUILD_PRIVATE_THREAD',
                13: 'GUILD_STAGE_VOICE',
                15: 'GUILD_FORUM',
                16: 'GUILD_MEDIA'
            };
            typeValue = typeMap[ch.type] || String(ch.type);
        } else if (typeof ch.type === 'string') {

            typeValue = ch.type;
        } else {

            typeValue = String(ch.type);
        }

        return {
            id: ch.id,
            name: ch.name,
            type: typeValue,
            parent_id: ch.parentId || null,
            position: ch.position !== undefined ? ch.position : null
        };
    });
}

export function formatTimestamp(timestamp = Date.now(), includeSeconds = false) {
    const formatter = new Intl.DateTimeFormat("id-ID", {
        timeZone: "Asia/Jakarta",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: includeSeconds ? "2-digit" : undefined,
        hour12: false,
    });

    return formatter.format(new Date(timestamp)).replace(",", "");
}
