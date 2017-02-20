# -*- coding: utf-8 -*-
{
     'name': """Payroll Russia""",
     'summary': """Salary calculations""",
     'category': '',
     'images': [],
     'version': '1.0.0',

     'author': 'IT-Projects LLC',
     'website': 'https://it-projects.info',
     'license': 'LGPL-3',
     #'price': 9.00,
     #'currency': 'EUR',

     'depends': [
         'account',
         'hr_payroll',
         'hr_payroll_account',
         'l10n_ru2',
     ],
     'external_dependencies': {'python': [], 'bin': []},
     'data': [
          'data/hr.salary.rule.xml',
          'data/hr.payroll.structure.xml'
     ],
     'demo': [
     ],
     'installable': False,
     'auto_install': False,
 }
