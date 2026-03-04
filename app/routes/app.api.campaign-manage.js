

export const action = async ({ request }) => {
  await authenticate.admin(request);

  return Response.json({
    success: true
  });
};
