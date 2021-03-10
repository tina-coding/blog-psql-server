import { Migration } from "@mikro-orm/migrations";

export class Migration20210308041046 extends Migration {
  async up(): Promise<void> {
    this.addSql('alter table "post" add column "description" text not null default(0);');
  }
}
