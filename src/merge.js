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
        const list = refs[i];

        // Find group in previous output.
        const index = prev.findIndex((group) => {
            return list.some((a) => group.some((b) => a.file == b.file));
        });

        if (index >= 0) {
            const old = prev[index];
            visited[index] = newlist.length;

            for (let j = 0;j < old.length;++j) {
                const ref = old[j];
                const found = list.find((record) => record.file == ref.file);

                if ((!found || found.entry != ref.entry) && ref.unlink) {
                    unlink.push(ref.entry);
                }
            }
        }

        newlist.push(list);
        reverse.push(index);
    }

    // Make a pass through the old list to bring in any groups that were
    // not visited.
    for (let i = 0;i < prev.length;++i) {
        if (visited[i] >= 0) {
            continue;
        }

        const list = prev[i];

        // TODO Figure out if the build products (if any) in the group
        // still have build targets in the project tree. If not, then we
        // delete the group.
        // ...

        // Scan to next group that was visited.
        let next = i+1;
        while (next < prev.length && visited[next] < 0) {
            next += 1;
        }

        if (next < prev.length) {
            // Walk backwards to either the beginning of the list or before
            // the last group that was visited.
            let index = visited[next];
            while (index-1 >= 0 && reverse[index-1] < 0) {
                index -= 1;
            }

            // Insert the group before the next visited group *and* any
            // new groups before it.
            newlist.splice(index,0,list);
            reverse.splice(index,0,i);
        }
        else {
            newlist.push(list);
            reverse.push(i);
        }
    }

    return newlist;

}

module.exports = merge_refs;
