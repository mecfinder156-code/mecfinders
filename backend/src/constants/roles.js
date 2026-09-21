'use strict';

const ROLES = Object.freeze({
  CUSTOMER: 'customer',
  MECHANIC: 'mechanic',
  ADMIN: 'admin',
  SUPERADMIN: 'superadmin',
});

const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPERADMIN];

module.exports = { ROLES, ADMIN_ROLES };
