/**
 * merge.js
 *
 * manifest (webdeploy plugin)
 */

function merge_refs(context,refs,prev,unlink) {
    const newlist = [];
    const visited = new Array(prev.length).fill(-1);
    const reverse = [];

    // Make a pass through the new list to figure out what files to
    // delete.
    for (let i = 0;i < refs.length;++i) {
        const entry = refs[i];

        // Find corresponding entry in previous output.
        const index = prev.findIndex((prevEntry) => {
            // For entries having numeric keys, the entries correspond if we
            // identify at least one ref that matches via its 'file' component.
            if (typeof entry.key === "number") {
                if (typeof prevEntry.key === "number") {
                    return entry.refs.some((a) => prevEntry.refs.some((b) => a.file == b.file));
                }

                return false;
            }

            // Otherwise they correspond directly via key.

            return entry.key === prevEntry.key;
        });

        if (index >= 0) {
            const old = prev[index].refs;
            visited[index] = newlist.length;

            for (let j = 0;j < old.length;++j) {
                const ref = old[j];
                const found = entry.refs.find((record) => record.file == ref.file);

                if ((!found || found.entry != ref.entry) && ref.unlink) {
                    unlink.push(ref.entry);
                }
            }
        }

        newlist.push(entry);
        reverse.push(index);
    }

    // Make a pass through the old list to bring in any entries that were not
    // visited.
    for (let i = 0;i < prev.length;++i) {
        if (visited[i] >= 0) {
            continue;
        }

        const entry = prev[i];

        // TODO Figure out if the build products (if any) in the entry still
        // have build targets in the project tree. If not, then we delete the
        // entry (and all its refs).
        // ...

        // Scan to the next entry that was visited (if any).
        let next = i+1;
        while (next < prev.length && visited[next] < 0) {
            next += 1;
        }

        if (next < prev.length) {
            // Walk backwards to either the beginning of the list or before
            // the last entry that was visited.
            let index = visited[next];
            while (index-1 >= 0 && reverse[index-1] < 0) {
                index -= 1;
            }

            // Insert the entry before the next visited entry *and* any new
            // entries before it.
            newlist.splice(index,0,entry);
            reverse.splice(index,0,i);
        }
        else {
            // Otherwise append the entry to the end of the list.
            newlist.push(entry);
            reverse.push(i);
        }
    }

    return newlist;

}

module.exports = merge_refs;
