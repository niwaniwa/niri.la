export default {
  async scheduled(_controller, env) {
    const hookUrl = env.PAGES_DEPLOY_HOOK_URL;
    if (!hookUrl) {
      throw new Error("PAGES_DEPLOY_HOOK_URL is not configured");
    }

    let response;
    try {
      response = await fetch(hookUrl, {
        method: "POST",
        redirect: "error",
      });
    } catch {
      // The hook URL is a secret and must not appear in Worker logs.
      throw new Error("Could not request a Cloudflare Pages build");
    }

    if (!response.ok) {
      throw new Error(
        `Cloudflare Pages Deploy Hook returned HTTP ${response.status}`,
      );
    }

    console.log(
      "Cloudflare Pages build requested; verify the deployment in Pages",
    );
  },
};
