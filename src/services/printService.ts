import {
  StarPrinter,
  StarConnectionSettings,
  InterfaceType,
  StarXpandCommand
} from "react-native-star-io10";

const PRINTER_WIDTH = 576;

export async function printToStarTSP100III(
  printerIp: string,
  base64Image: string
): Promise<void> {

  const settings = new StarConnectionSettings();
  settings.interfaceType = InterfaceType.Lan;
  settings.identifier = printerIp;

  const printer = new StarPrinter(settings);

  try {

    await printer.open();
    console.log("Printer connected");

    console.log("Image received, length:", base64Image.length);

    const builder = new StarXpandCommand.StarXpandCommandBuilder();

    builder.addDocument(
      new StarXpandCommand.DocumentBuilder()
        .addPrinter(
          new StarXpandCommand.PrinterBuilder()
            .actionPrintImage(
              new StarXpandCommand.Printer.ImageParameter(
                base64Image,
                PRINTER_WIDTH
              )
            )
            .actionFeedLine(3)
            .actionCut(StarXpandCommand.Printer.CutType.Partial)
        )
    );

    const commands = await builder.getCommands();

    await printer.print(commands);

    console.log("Print successful");

  } catch (err) {

    console.error("Print error:", err);
    throw err;

  } finally {

    try {
      await printer.close();
    } catch {}

  }
}