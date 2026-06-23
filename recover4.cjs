const fs = require('fs');

const logFile = 'C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\f8b7f3ed-1193-4971-a23a-b058ef7b5b3f\\.system_generated\\logs\\transcript.jsonl';

// Start with the file contents from the git commit, normalize to \n!
let currentContent = fs.readFileSync('f:\\projects\\VKS\\vks-compiler\\llvm-emitter.vks', 'utf8').replace(/\r\n/g, '\n');

function normalize(str) {
    if (!str) return str;
    return str.replace(/\r\n/g, '\n');
}

function processLog(logFile) {
    if (!fs.existsSync(logFile)) return;
    const lines = fs.readFileSync(logFile, 'utf8').split('\n');
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
                for (const call of entry.tool_calls) {
                    if (!call.args.TargetFile || !call.args.TargetFile.toLowerCase().includes('llvm-emitter.vks')) continue;
                    
                    if (call.name === 'write_to_file') {
                        if (call.args.Overwrite === "true" || call.args.Overwrite === true || currentContent === "") {
                            currentContent = normalize(call.args.CodeContent);
                            console.log(`[write_to_file] step ${entry.step_index}, length: ${currentContent.length}`);
                        }
                    } else if (call.name === 'replace_file_content') {
                        const target = normalize(call.args.TargetContent);
                        const replacement = normalize(call.args.ReplacementContent);
                        if (currentContent.includes(target)) {
                            currentContent = currentContent.replace(target, replacement);
                            console.log(`[replace_file_content] step ${entry.step_index}, len: ${currentContent.length}`);
                        } else {
                            console.log(`[replace_file_content] FAILED at step ${entry.step_index}`);
                        }
                    } else if (call.name === 'multi_replace_file_content') {
                        let success = true;
                        let newContent = currentContent;
                        for (const chunk of call.args.ReplacementChunks) {
                            const target = normalize(chunk.TargetContent);
                            const replacement = normalize(chunk.ReplacementContent);
                            if (newContent.includes(target)) {
                                newContent = newContent.replace(target, replacement);
                            } else {
                                success = false;
                                console.log(`[multi_replace_file_content] FAILED chunk at step ${entry.step_index}`);
                            }
                        }
                        if (success) {
                            currentContent = newContent;
                            console.log(`[multi_replace_file_content] Applied at step ${entry.step_index}, len: ${currentContent.length}`);
                        } else {
                             // apply sequentially
                             let appliedSome = false;
                             for (const chunk of call.args.ReplacementChunks) {
                                const target = normalize(chunk.TargetContent);
                                const replacement = normalize(chunk.ReplacementContent);
                                if (currentContent.includes(target)) {
                                    currentContent = currentContent.replace(target, replacement);
                                    appliedSome = true;
                                }
                             }
                             if (appliedSome) {
                                 console.log(`[multi_replace_file_content] Partially applied at step ${entry.step_index}, len: ${currentContent.length}`);
                             }
                        }
                    }
                }
            } else if (entry.type === 'PLANNER_RESPONSE' && entry.tool_calls) {
                 for (const call of entry.tool_calls) {
                    if (call.name === 'run_command' && call.args.CommandLine && call.args.CommandLine.includes('llvm-emitter.vks') && call.args.CommandLine.includes('-replace')) {
                        console.log(`[run_command] Found manual replace at step ${entry.step_index}: ${call.args.CommandLine}`);
                        if (call.args.CommandLine.includes('dbg_p1')) {
                            // ignore
                        } else {
                            // Can't auto-apply powershell replaces... let's just log
                        }
                    }
                 }
            }
        } catch (e) {
            // ignore
        }
    }
}

processLog(logFile);

fs.writeFileSync('vks-compiler/llvm-emitter.vks.recovered', currentContent);
console.log(`Recovered file length: ${currentContent.length}`);
