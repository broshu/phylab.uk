// phylab.uk：www.phylab.uk 跳到 phylab.uk，其余请求直接发网站文件。
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname === 'www.phylab.uk') {
      url.hostname = 'phylab.uk';
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
