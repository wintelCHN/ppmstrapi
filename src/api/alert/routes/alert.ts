/**
 * Alert routes — workflow failure notification endpoint.
 */
export default {
  type: 'content-api',
  routes: [
    {
      method: 'POST',
      path: '/alert/failure',
      handler: 'alert.sendFailure',
      config: { auth: false, policies: [] },
    },
  ],
}
