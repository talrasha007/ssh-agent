const SSH = require('ssh2-promise');

module.exports.handler = awslambda.streamifyResponse(async (event, responseStream) => {
  let ssh;
  try {
    const body = JSON.parse(event.body);
    const searchParams = new URLSearchParams(event.path);
    const host = body.host || searchParams.get('host');
    const port = body.port || parseInt(searchParams.get('port')) || 22;
    const username = body.username || searchParams.get('username');
    const password = body.password || searchParams.get('password');
    const privateKey = body.privateKey || searchParams.get('privateKey');

    const config = { host, port, username, password, privateKey };
  
    ssh = new SSH(config);
    await ssh.connect();

    const shell = await ssh.shell();

    let onData;
    shell.on('data', data => {
      data = data.toString();
      responseStream.write(`data: ${JSON.stringify({ data })}\n\n`);
      if (onData) onData(data);
    });

    for (const command of body.commands) {
      shell.write(command + '\n');
      await new Promise(r => {
        let lastData = '';
        onData = data => {
          if (data.includes(command) && !lastData.endsWith('\n')) {
            onData = null;
            r();
          }
          lastData = data;
        };
      });
    }

    shell.write('exit\n');
    await new Promise(resolve => shell.on('close', resolve));
  } catch (e) {
    responseStream.write(`data: ${JSON.stringify({ error: e.message || e })}\n\n`);
  } finally {
    if (ssh) await ssh.close().catch(() => {});
    responseStream.end();
  }
});