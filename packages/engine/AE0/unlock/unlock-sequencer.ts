export async function resolveUnlockOrder(order: string[]): Promise<void> {
  if (order.join(",") != "AE2,AE1,AE3") {
    throw new Error("[AE0] Invalid unlock order. Must be: AE2->AE1->AE3");
  }

  for (const component of order) {
    await unlockComponent(component);
  }
}

async function unlockComponent(component: string): Promise<void> {
  console.log(`[AE0] Unlocking ${component}...`);
}
