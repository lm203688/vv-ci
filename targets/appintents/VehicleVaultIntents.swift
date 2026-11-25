import AppIntents
import Foundation

// VehicleVault：保养、里程、油耗、费用台账。
// 台账本身在 SQLite 里，意图层不读库；这里做两件"开着车也会问"的算术：
// 下次保养到底哪一天/哪一里数先到，以及这趟跑下来油钱多少、每英里多少。

@available(iOS 16.0, *)
struct ServiceCadenceEntity: AppEntity {
  static var typeDisplayRepresentation: TypeDisplayRepresentation = TypeDisplayRepresentation(name: "Service interval")
  static var defaultQuery = ServiceCadenceQuery()

  let id: String

  let summary: String
  let months: Int
  let miles: Int

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(summary)", subtitle: "\(months) months or \(miles) miles")
  }

  static let all: [ServiceCadenceEntity] = [
    ServiceCadenceEntity(id: "oem-6m", summary: "Short interval", months: 6, miles: 5_000),
    ServiceCadenceEntity(id: "oem-12m", summary: "Standard interval", months: 12, miles: 10_000),
    ServiceCadenceEntity(id: "oem-12m-15k", summary: "Long interval", months: 12, miles: 15_000),
    ServiceCadenceEntity(id: "oem-24m", summary: "Two-year interval", months: 24, miles: 20_000),
    ServiceCadenceEntity(id: "custom", summary: "Custom interval", months: 0, miles: 0),
  ]
}

@available(iOS 16.0, *)
struct ServiceCadenceQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [ServiceCadenceEntity] {
    ServiceCadenceEntity.all.filter { identifiers.contains($0.id) }
  }

  func suggestedEntities() async throws -> [ServiceCadenceEntity] {
    ServiceCadenceEntity.all
  }

  func defaultResult() async -> ServiceCadenceEntity? {
    ServiceCadenceEntity.all.first(where: { $0.id == "oem-12m" })
  }
}

@available(iOS 16.0, *)
private enum VVDue {
  static let day: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "d MMM yyyy"
    return f
  }()

  static func rounded(_ value: Double, _ digits: Int) -> String {
    String(format: "%.\(digits)f", value)
  }
}

@available(iOS 16.0, *)
struct ServiceDueIntent: AppIntent {
  static var title: LocalizedStringResource = "When is my next service"
  static var description: IntentDescription? = IntentDescription(
    "Takes the mileage and date of the last service plus your annual mileage and works out which comes first: the mileage interval or the time interval."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Mileage at last service", requestValueDialog: "What was the odometer at the last service?")
  var lastMileage: Double

  @Parameter(title: "Date of last service", requestValueDialog: "When was the last service?")
  var lastService: Date

  @Parameter(title: "Miles driven per year", default: 12000)
  var annualMiles: Double

  @Parameter(title: "Interval")
  var cadence: ServiceCadenceEntity

  @Parameter(title: "Interval in miles (custom only)", default: 10000)
  var intervalMiles: Double

  @Parameter(title: "Interval in months (custom only)", default: 12)
  var intervalMonths: Int

  static var parameterSummary: some ParameterSummary {
    Summary("Next service after \(\.$lastMileage) miles on \(\.$cadence)")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let miles = cadence.miles > 0 ? Double(cadence.miles) : intervalMiles
    let months = cadence.months > 0 ? cadence.months : intervalMonths
    guard miles > 0 || months > 0 else {
      return .result(dialog: "Give me either a mileage interval or a month interval and I can work out the next service.")
    }

    let calendar = Calendar.current
    let today = calendar.startOfDay(for: Date())
    let last = calendar.startOfDay(for: lastService)

    let mileTarget = miles > 0 ? lastMileage + miles : 0
    let annual = annualMiles > 0 ? annualMiles : 12000
    let daysByMiles = miles > 0 ? Int((miles / annual * 365).rounded()) : 0
    let mileDate = calendar.date(byAdding: .day, value: daysByMiles, to: last) ?? last
    let timeDate = months > 0 ? (calendar.date(byAdding: .month, value: months, to: last) ?? last) : mileDate

    let byMiles = miles > 0 && mileDate <= timeDate
    let dueDate = byMiles ? mileDate : timeDate
    let until = calendar.dateComponents([.day], from: today, to: dueDate).day ?? 0

    var detail = ""
    if miles > 0 {
      detail += " Mileage trigger at " + VVDue.rounded(mileTarget, 0) + " mi (about " + VVDue.day.string(from: mileDate) + ")."
    }
    if months > 0 {
      detail += " Time trigger on " + VVDue.day.string(from: timeDate) + "."
    }
    let first = byMiles ? "Mileage comes first" : "The calendar comes first"
    let when: String
    if until < 0 {
      when = " overdue by " + String(-until) + " days"
    } else if until == 0 {
      when = " due today"
    } else {
      when = " due in " + String(until) + " days"
    }
    return .result(
      dialog: IntentDialog(stringLiteral: first + ":" + when + " (" + VVDue.day.string(from: dueDate) + ")." + detail)
    )
  }
}

@available(iOS 16.0, *)
struct FuelCostIntent: AppIntent {
  static var title: LocalizedStringResource = "What will this trip cost in fuel"
  static var description: IntentDescription? = IntentDescription(
    "Turns a distance, your MPG and the pump price into gallons needed, total cost and cost per mile."
  )
  static var openAppWhenRun: Bool = false

  @Parameter(title: "Distance in miles", requestValueDialog: "How far are you going?")
  var distanceMiles: Double

  @Parameter(title: "Miles per gallon", requestValueDialog: "What MPG do you actually get?")
  var milesPerGallon: Double

  @Parameter(title: "Price per gallon", requestValueDialog: "What is fuel per gallon?")
  var pricePerGallon: Double

  static var parameterSummary: some ParameterSummary {
    Summary("Fuel cost for \(\.$distanceMiles) miles")
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard distanceMiles > 0, milesPerGallon > 0, pricePerGallon >= 0 else {
      return .result(dialog: "I need a positive distance and MPG, and a non-negative pump price.")
    }
    let gallons = distanceMiles / milesPerGallon
    let cost = gallons * pricePerGallon
    let perMile = pricePerGallon / milesPerGallon
    let lines = "You need " + VVDue.rounded(gallons, 1) + " gal, costing " + VVDue.rounded(cost, 2) + ". That is "
      + VVDue.rounded(perMile, 3) + " per mile at " + VVDue.rounded(pricePerGallon, 2) + "/gal."
    return .result(dialog: IntentDialog(stringLiteral: lines))
  }
}

@available(iOS 16.0, *)
struct VehicleVaultOpenIntent: AppIntent {
  static var title: LocalizedStringResource = "Open VehicleVault"
  static var description: IntentDescription? = IntentDescription(
    "Opens VehicleVault: service history, mileage and running costs for your vehicles."
  )
  static var openAppWhenRun: Bool = true

  func perform() async throws -> some IntentResult {
    return .result()
  }
}

@available(iOS 16.0, *)
struct VehicleVaultShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: ServiceDueIntent(),
      phrases: [
        "When is my next service in \(.applicationName)",
        "Next oil change in \(.applicationName)",
      ],
      shortTitle: "Next service",
      systemImageName: "wrench.and.screwdriver"
    )
    AppShortcut(
      intent: FuelCostIntent(),
      phrases: [
        "Fuel cost for a trip in \(.applicationName)",
        "What will this drive cost in \(.applicationName)",
      ],
      shortTitle: "Trip fuel cost",
      systemImageName: "fuelpump"
    )
    AppShortcut(
      intent: VehicleVaultOpenIntent(),
      phrases: ["Open \(.applicationName)", "Launch \(.applicationName)"],
      shortTitle: "Open VehicleVault",
      systemImageName: "car"
    )
  }
}

// Spotlight: from iOS 18 the entity is searchable system-wide by its display name.
@available(iOS 18.0, *)
extension ServiceCadenceEntity: IndexedEntity {}
