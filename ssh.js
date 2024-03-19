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

    for (const command of body.commands) {
      responseStream.write(`data: ${JSON.stringify({ data: command + '\n' })}\n\n`);
      const socket = await ssh.spawn(command);
      socket.on('data', data => responseStream.write(`data: ${JSON.stringify({ data: data.toString() })}\n\n`));
      await new Promise((resolve, reject) => {
        socket.on('close', resolve);
        socket.on('error', e => reject(e));
      });
    }
  } catch (e) {
    responseStream.write(`data: ${JSON.stringify({ error: e.message || e })}\n\n`);
  } finally {
    if (ssh) await ssh.close().catch(() => {});
    responseStream.end();
  }
});