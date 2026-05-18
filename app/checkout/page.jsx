import CustomerCheckout from "../../components/customer-checkout";
import { listProducts } from "../../lib/inventory";

export const metadata = {
  title: "Checkout | Crockery Inventory Manager",
};

export default async function CheckoutPage() {
  const products = await listProducts();

  return <CustomerCheckout initialProducts={products} />;
}
