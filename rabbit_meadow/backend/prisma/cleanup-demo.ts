import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const summary = await prisma.$transaction(async (tx) => {
    const discountTargets = await tx.discountTarget.deleteMany();
    const orderStatusLogs = await tx.orderStatusLog.deleteMany();
    const orderItems = await tx.orderItem.deleteMany();
    const inventoryMovements = await tx.inventoryMovement.deleteMany();
    const cartItems = await tx.cartItem.deleteMany();
    const discounts = await tx.discount.deleteMany();
    const orders = await tx.order.deleteMany();
    const carts = await tx.cart.deleteMany();
    const products = await tx.product.deleteMany();
    const categories = await tx.category.deleteMany();
    const userAddresses = await tx.userAddress.deleteMany();
    const customers = await tx.user.deleteMany({
      where: { role: UserRole.CUSTOMER },
    });

    return {
      discountTargets: discountTargets.count,
      orderStatusLogs: orderStatusLogs.count,
      orderItems: orderItems.count,
      inventoryMovements: inventoryMovements.count,
      cartItems: cartItems.count,
      discounts: discounts.count,
      orders: orders.count,
      carts: carts.count,
      products: products.count,
      categories: categories.count,
      userAddresses: userAddresses.count,
      customers: customers.count,
    };
  }, {
    maxWait: 10000,
    timeout: 30000,
  });

  console.log('Demo cleanup completed. Deleted rows summary:');
  console.table(summary);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
